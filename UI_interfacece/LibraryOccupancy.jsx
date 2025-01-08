// File: LibraryOccupancy.jsx

import React, { useState, useEffect } from "react";
import { WiDaySunny, WiCloudy, WiRain, WiSnow } from "react-icons/wi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";

import { database, ref, onValue } from "./firebase";

// ─────────────────────────────────────────────────────────────────────────────
// 1) OccupancyCard
// ─────────────────────────────────────────────────────────────────────────────
const OccupancyCard = React.memo(
  ({
    title,
    occupancy,
    data,
    onHover,
    onLeave,
    getBarColor,
    getColorFromOccupancy,
    isMobile,
    isFirstCard,
    isTomorrow,
    onToggleTomorrow,
    areaKey
  }) => (
    <div
      className={`bg-white rounded-lg shadow-lg overflow-visible hover:shadow-xl transition-all duration-300 relative ${
        isMobile ? "w-full mb-4" : "w-[300px] h-[150px]"
      }`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      <div className={`${isMobile ? "p-4" : "p-3"} h-full flex flex-col justify-between`}>
        <div className="flex justify-between items-center mb-2">
          <h3 className={`${isMobile ? "text-lg" : "text-xl"} font-bold text-gray-700`}>
            {title}
          </h3>
          <div
            className={`${isMobile ? "text-xl" : "text-2xl"} font-bold`}
            style={{ color: getColorFromOccupancy(occupancy) }}
          >
            {occupancy}%
          </div>
        </div>

        {/* If this is the first card, show the "Today / Tomorrow" toggle button */}
        {isFirstCard && (
          <div className="mb-1 flex items-center justify-start">
            <button
              onClick={onToggleTomorrow}
              className="px-2 py-1 bg-blue-500 text-white rounded-lg text-sm mr-2"
            >
              Toggle Forecast
            </button>
            <span className="text-gray-600 text-xs">
              Currently viewing: {isTomorrow ? "Tomorrow" : "Today"}
            </span>
          </div>
        )}

        {/* Wrapper for the bar chart */}
        <div
          className={
            isMobile
              ? "h-[150px] w-full"
              : "w-full h-[200px] -mb-[15px] -ml-[10px]"
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={
                isMobile
                  ? { left: 0, right: 10, top: 10, bottom: 5 }
                  : { left: 10, right: 25, top: 10, bottom: 5 }
              }
            >
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
                width={isMobile ? 30 : 35}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload && payload.length ? (
                    <div
                      className="bg-white shadow-lg rounded-lg p-2 border border-gray-200 absolute pointer-events-none"
                      style={{
                        transform: "translate(10px, 80px)",
                        zIndex: 1000,
                        minWidth: "160px"
                      }}
                    >
                      <p className="font-semibold text-gray-900 text-sm">
                        Time: {label}
                      </p>
                      <p
                        className="font-medium text-sm"
                        style={{ color: getColorFromOccupancy(payload[0].value) }}
                      >
                        Occupancy: {payload[0].value}%
                      </p>
                    </div>
                  ) : null
                }
              />
              <Bar
                dataKey="occupancy"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {data.map((entry) => (
                  <Cell key={`cell-${entry.time}`} fill={getBarColor(entry.time, areaKey)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// 2) OccupancyComparison (Real vs Predicted)
// ─────────────────────────────────────────────────────────────────────────────
const OccupancyComparison = ({ isMobile }) => {
  const [visibleLines, setVisibleLines] = useState({
    main: true,
    southEast: false,
    north: false,
    south: false,
    angdomen: false,
    newton: false
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [parsedData, setParsedData] = useState([]);
  const [rmeData, setRmeData] = useState({});
  const [mapeData, setMapeData] = useState({});
  const [parsedDate, setParsedDate] = useState(null);
  const [error, setError] = useState(null);

  const colors = {
    // MAIN
    Occupancy_main_real: "#8884d8",
    Occupancy_main_predicted: "#8884d8",
    // SOUTH-EAST
    Occupancy_southEast_real: "#82ca9d",
    Occupancy_southEast_predicted: "#82ca9d",
    // NORTH
    Occupancy_north_real: "#ffc658",
    Occupancy_north_predicted: "#ffc658",
    // SOUTH
    Occupancy_south_real: "#ff7300",
    Occupancy_south_predicted: "#ff7300",
    // ÅNGDOMEN
    Occupancy_angdomen_real: "#e91e63",
    Occupancy_angdomen_predicted: "#e91e63",
    // NEWTON
    Occupancy_newton_real: "#00bcd4",
    Occupancy_newton_predicted: "#00bcd4"
  };

  const labelMap = [
    { key: "main", label: "Main" },
    { key: "southEast", label: "SouthEast" },
    { key: "north", label: "North" },
    { key: "south", label: "South" },
    { key: "angdomen", label: "Angdomen" },
    { key: "newton", label: "Newton" }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          "https://huggingface.co/datasets/davnas/library-occupancy/resolve/main/Real_vs_Predicted_Occupancy_Data.csv"
        );
        const text = await response.text();
        const rows = text.split("\n").filter((r) => r.trim() !== "");

        if (rows.length === 0) {
          throw new Error("CSV is empty");
        }

        const header = rows[0].split(",").map((h) => h.trim());
        
        // Find RME and MAPE rows - look for exact matches
        const rmeRowIndex = rows.findIndex(row => row.includes(',RME,'));
        const mapeRowIndex = rows.findIndex(row => row.includes(',MAPE,'));

        // Get time series data (exclude RME and MAPE rows)
        const timeSeriesRows = rows.slice(1, rmeRowIndex);

        const timeSeriesData = timeSeriesRows.map((row) => {
          const cols = row.split(",").map(val => val.trim());
          const obj = {};
          header.forEach((colName, idx) => {
            // Convert string numbers to actual numbers, handling decimal points
            obj[colName] = colName !== 'Date' && colName !== 'Time' 
              ? parseFloat(cols[idx]) || 0 
              : cols[idx];
          });
          return obj;
        });

        // Extract date from first row
        const firstDateEntry = timeSeriesRows[0]?.split(",")[0]?.trim();
        setParsedDate(firstDateEntry || "unknown date");

        // Parse RME
        if (rmeRowIndex !== -1) {
          const rmeValues = rows[rmeRowIndex].split(",").map(val => val.trim());
          const rmeObj = {};
          header.forEach((colName, idx) => {
            if (colName.includes('predicted')) {
              rmeObj[colName] = parseFloat(rmeValues[idx]) || 0;
            }
          });
          setRmeData(rmeObj);
        }

        // Parse MAPE
        if (mapeRowIndex !== -1) {
          const mapeValues = rows[mapeRowIndex].split(",").map(val => val.trim());
          const mapeObj = {};
          header.forEach((colName, idx) => {
            if (colName.includes('predicted')) {
              mapeObj[colName] = parseFloat(mapeValues[idx]) || 0;
            }
          });
          setMapeData(mapeObj);
        }

        setParsedData(timeSeriesData);
        
        // Add this debug log:
        console.log('Parsed Data:', {
          timeSeriesData: timeSeriesData,
          rmeData: rmeData,
          mapeData: mapeData
        });

      } catch (error) {
        console.error("Error fetching Real-vs-Predicted CSV:", error);
        setError("Failed to load occupancy comparison data.");
      }
    };

    fetchData();
  }, []);

  const toggleLine = (areaKey) => {
    setVisibleLines((prev) => {
      // Switch off other lines, toggle only the clicked one
      const newState = Object.keys(prev).reduce((acc, key) => {
        acc[key] = key === areaKey ? !prev[key] : false;
        return acc;
      }, {});
      return newState;
    });
  };

  const currentVisibleAreaKey =
    Object.keys(visibleLines).find((key) => visibleLines[key]) || "main";
  const currentArea = labelMap.find(({ key }) => key === currentVisibleAreaKey);
  const currentAreaLabel = currentArea ? currentArea.label : "Main";

  if (error) {
    return (
      <div className="bg-red-100 text-red-500 p-4 rounded-md mt-4">
        <p>{error}</p>
      </div>
    );
  }

  if (isMobile) {
    // Render each area chart sequentially in mobile
    const areas = [
      { key: "main", label: "Main" },
      { key: "southEast", label: "SouthEast" },
      { key: "north", label: "North" },
      { key: "south", label: "South" },
      { key: "angdomen", label: "Angdomen" },
      { key: "newton", label: "Newton" }
    ];

    return (
      <div className="mt-8 w-full max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Occupancy Comparison</h2>
          <p className="text-gray-700 mb-4">
            Real vs Predicted Occupancy for Each Area
          </p>

          <p className="mb-6 text-gray-900">
            This is the prediction made yesterday ({parsedDate}) versus the real occupancy
            we had yesterday.
          </p>

          {areas.map((area, index) => (
            <div key={area.key} className="mb-8 last:mb-0">
              <div className="flex items-center mb-2">
                <span className="text-lg font-semibold mr-2">{index + 1}.</span>
                <h3 className="text-lg font-bold text-gray-700">{area.label}</h3>
              </div>

              <div className="bg-white rounded-lg shadow-md p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={parsedData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="Time"
                      height={60}
                      tick={{
                        angle: -45,
                        textAnchor: "end",
                        fontSize: 12
                      }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      wrapperStyle={{ paddingBottom: "20px" }}
                    />

                    <Line
                      type="monotone"
                      dataKey={`Occupancy_${area.key}_real`}
                      name={`${area.label} (Real)`}
                      stroke={colors[`Occupancy_${area.key}_real`]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey={`Occupancy_${area.key}_predicted`}
                      name={`${area.label} (Predicted --)`}
                      stroke={colors[`Occupancy_${area.key}_predicted`]}
                      strokeWidth={2}
                      strokeDasharray="4 2"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>

                <div className="mt-2 text-sm text-gray-600">
                  <p>
                    <span className="font-semibold">MAPE:</span>{" "}
                    {typeof mapeData[`Occupancy_${area.key}_predicted`] !== 'undefined'
                      ? `${mapeData[`Occupancy_${area.key}_predicted`].toFixed(2)}%`
                      : "N/A"}
                  </p>
                  <p>
                    <span className="font-semibold">RME:</span>{" "}
                    {typeof rmeData[`Occupancy_${area.key}_predicted`] !== 'undefined'
                      ? `${rmeData[`Occupancy_${area.key}_predicted`].toFixed(2)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop layout for the comparison
  return (
    <div className="mt-8 w-full max-w-4xl">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-white rounded-lg shadow-md p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-gray-800">Occupancy Comparison</h2>
        </div>
        <svg
          className={`w-6 h-6 transform transition-transform ${
            isExpanded ? "rotate-180" : ""
          } text-gray-600`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden mt-2 ${
          isExpanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="mb-4 text-gray-700">
            <p className="mb-2">
              This is the prediction made yesterday ({parsedDate}) versus the real occupancy
              we had yesterday.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="font-semibold">
                {currentAreaLabel}:
                <span className="text-blue-600">
                  {" "}
                  RME:{" "}
                  {typeof rmeData[`Occupancy_${currentVisibleAreaKey}_predicted`] !== 'undefined'
                    ? `${rmeData[`Occupancy_${currentVisibleAreaKey}_predicted`].toFixed(2)}%`
                    : "N/A"}
                </span>
                <span className="text-blue-600 ml-2">
                  MAPE:{" "}
                  {typeof mapeData[`Occupancy_${currentVisibleAreaKey}_predicted`] !== 'undefined'
                    ? `${mapeData[`Occupancy_${currentVisibleAreaKey}_predicted`].toFixed(2)}%`
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex flex-wrap md:flex-col gap-2 w-full md:w-32">
              {labelMap.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => toggleLine(key)}
                  className={`px-2 py-1 text-sm rounded-lg text-white transition-opacity flex-1 md:flex-none ${
                    visibleLines[key] ? "opacity-100" : "opacity-40"
                  }`}
                  style={{
                    backgroundColor: colors[`Occupancy_${key}_real`] || "#8884d8"
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={parsedData} margin={{ top: 10, right: 30, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="Time"
                    height={60}
                    tick={{
                      angle: -45,
                      textAnchor: "end",
                      fontSize: 12
                    }}
                  />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                  <Tooltip />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: "20px" }} />

                  {/* MAIN */}
                  {visibleLines.main && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="Occupancy_main_real"
                        name="Main (Real)"
                        stroke={colors["Occupancy_main_real"]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Occupancy_main_predicted"
                        name="Main (Predicted --)"
                        stroke={colors["Occupancy_main_predicted"]}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}

                  {/* SOUTH-EAST */}
                  {visibleLines.southEast && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="Occupancy_southEast_real"
                        name="SouthEast (Real)"
                        stroke={colors["Occupancy_southEast_real"]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Occupancy_southEast_predicted"
                        name="SouthEast (Predicted --)"
                        stroke={colors["Occupancy_southEast_predicted"]}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}

                  {/* NORTH */}
                  {visibleLines.north && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="Occupancy_north_real"
                        name="North (Real)"
                        stroke={colors["Occupancy_north_real"]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Occupancy_north_predicted"
                        name="North (Predicted --)"
                        stroke={colors["Occupancy_north_predicted"]}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}

                  {/* SOUTH */}
                  {visibleLines.south && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="Occupancy_south_real"
                        name="South (Real)"
                        stroke={colors["Occupancy_south_real"]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Occupancy_south_predicted"
                        name="South (Predicted --)"
                        stroke={colors["Occupancy_south_predicted"]}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}

                  {/* ÅNGDOMEN */}
                  {visibleLines.angdomen && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="Occupancy_angdomen_real"
                        name="Ångdomen (Real)"
                        stroke={colors["Occupancy_angdomen_real"]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Occupancy_angdomen_predicted"
                        name="Ångdomen (Predicted --)"
                        stroke={colors["Occupancy_angdomen_predicted"]}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}

                  {/* NEWTON */}
                  {visibleLines.newton && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="Occupancy_newton_real"
                        name="Newton (Real)"
                        stroke={colors["Occupancy_newton_real"]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="Occupancy_newton_predicted"
                        name="Newton (Predicted --)"
                        stroke={colors["Occupancy_newton_predicted"]}
                        strokeWidth={2}
                        strokeDasharray="4 2"
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 3) Main LibraryOccupancy component
// ─────────────────────────────────────────────────────────────────────────────
const LibraryOccupancy = () => {
  const [occupancyData, setOccupancyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentOccupancy, setCurrentOccupancy] = useState(0);
  const [currentHour, setCurrentHour] = useState("");
  const [hoveredCard, setHoveredCard] = useState(null);
  const [weather, setWeather] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [realTimeOccupancy, setRealTimeOccupancy] = useState({
    main: 0,
    southEast: 0,
    north: 0,
    south: 0,
    angdomen: 0,
    newton: 0
  });
  const [isFirebaseInitialized, setIsFirebaseInitialized] = useState(false);

  // NEW: We'll store the commitTime from the first row of the CSV
  const [commitTime, setCommitTime] = useState(null);
  const [occupancyDataTomorrow, setOccupancyDataTomorrow] = useState([]);
  const [isTomorrow, setIsTomorrow] = useState(false);

  // NEW: Format date for display
  const getFormattedDate = (addDays = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + addDays);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Check if screen is mobile
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    if (typeof window !== "undefined") {
      window.addEventListener("resize", checkMobile);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", checkMobile);
      }
    };
  }, []);

  // Initialize Firebase and set up real-time occupancy
  useEffect(() => {
    let unsubscribe = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const cachedValues = localStorage.getItem("libraryOccupancy");
    if (cachedValues) {
      try {
        const parsed = JSON.parse(cachedValues);
        setRealTimeOccupancy(parsed);
      } catch (e) {
        console.error("Error parsing cached values:", e);
      }
    }

    const initFirebase = async () => {
      try {
        const occupancyRef = ref(database, "current-occupancy");
        if (unsubscribe) {
          unsubscribe();
        }

        unsubscribe = onValue(
          occupancyRef,
          (snapshot) => {
            const data = snapshot.val();
            if (data) {
              const newValues = {
                main: data.main || 0,
                southEast: data.southEast || 0,
                north: data.north || 0,
                south: data.south || 0,
                angdomen: data.angdomen || 0,
                newton: data.newton || 0
              };

              setRealTimeOccupancy(newValues);
              setIsFirebaseInitialized(true);
              localStorage.setItem("libraryOccupancy", JSON.stringify(newValues));
            }
          },
          (error) => {
            console.error("Firebase error:", error);
            retryConnection();
          }
        );
      } catch (error) {
        console.error("Firebase initialization error:", error);
        retryConnection();
      }
    };

    const retryConnection = () => {
      if (retryCount < MAX_RETRIES) {
        retryCount++;
        console.log(`Retrying Firebase connection (${retryCount}/${MAX_RETRIES})...`);
        setTimeout(initFirebase, 2000 * retryCount);
      } else {
        setError("Unable to establish real-time connection. Using cached data.");
      }
    };

    initFirebase();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Fetch CSV + Weather
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          "https://huggingface.co/datasets/davnas/library-occupancy/raw/main/data_2.csv"
        );
        const text = await response.text();
        const rows = text.split("\n");

        // Parse the new CSV structure:
        // commitTime, time, main, southEast, north, south, angdomen, newton
        const parsed = rows
          .slice(1)
          .filter((row) => row.trim() !== "")
          .map((row) => {
            const values = row.split(",");
            return {
              commitTime: values[0].trim(),
              time: values[1].trim(),
              main: parseInt(values[2], 10),
              southEast: parseInt(values[3], 10),
              north: parseInt(values[4], 10),
              south: parseInt(values[5], 10),
              angdomen: parseInt(values[6], 10),
              newton: parseInt(values[7], 10)
            };
          });

        setOccupancyData(parsed);

        // Set the commitTime from the first (or last) row — here we use the first row
        if (parsed.length > 0) {
          setCommitTime(parsed[0].commitTime);
        }

        // Update current occupancy based on time-of-day
        const now = new Date();
        const hour = now.getHours().toString().padStart(2, "0");
        const minute = Math.floor(now.getMinutes() / 30) * 30;
        const formattedTime = `${hour}:${minute === 0 ? "00" : "30"}`;
        setCurrentHour(formattedTime);

        const currentData = parsed.find((entry) => entry.time === formattedTime);
        if (currentData) {
          // Optionally override realTimeOccupancy with CSV data if desired
          // setCurrentOccupancy(currentData.main);
          // setRealTimeOccupancy({
          //   main: currentData.main,
          //   southEast: currentData.southEast,
          //   north: currentData.north,
          //   south: currentData.south,
          //   angdomen: currentData.angdomen,
          //   newton: currentData.newton
          // });
        }
      } catch (err) {
        setError(`Error loading data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    const fetchWeather = async () => {
      try {
        const response = await fetch(
          "https://api.weatherapi.com/v1/current.json?key=9bb3873cd7fc42c8ac1190047241211&q=Stockholm&aqi=no"
        );
        const data = await response.json();
        setWeather(data.current);
      } catch (error) {
        console.error("Error fetching weather:", error);
      }
    };

    Promise.all([fetchData(), fetchWeather()]).catch((error) => {
      console.error("Error fetching data:", error);
      setError("Error loading data. Please try again.");
      setLoading(false);
    });
  }, []);

  // NEW: fetch tomorrow's data (same CSV for now)
  useEffect(() => {
    const fetchTomorrowData = async () => {
      try {
        // For now, we are using the same CSV endpoint as an example
        const response = await fetch(
          "https://huggingface.co/datasets/davnas/library-occupancy/raw/main/forecast_tomorrow.csv"
        );
        const text = await response.text();
        const rows = text.split("\n");

        const parsed = rows
          .slice(1)
          .filter((row) => row.trim() !== "")
          .map((row) => {
            const values = row.split(",");
            return {
              commitTime: values[0].trim(),
              time: values[1].trim(),
              main: parseInt(values[2], 10),
              southEast: parseInt(values[3], 10),
              north: parseInt(values[4], 10),
              south: parseInt(values[5], 10),
              angdomen: parseInt(values[6], 10),
              newton: parseInt(values[7], 10)
            };
          });

        setOccupancyDataTomorrow(parsed);
      } catch (error) {
        console.error("Error fetching tomorrow data:", error);
      }
    };
    fetchTomorrowData();
  }, []);

  if (loading || !isFirebaseInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 bg-red-100 p-4 rounded-lg">
          <h3 className="font-bold mb-2">Error</h3>
          <p>{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getColorFromOccupancy = (occupancy) => {
    if (occupancy <= 50) return "#22c55e"; // green
    if (occupancy <= 80) return "#f97316"; // orange
    return "#dc2626"; // red
  };

  const getBarColor = (time, areaKey) => {
    // If viewing tomorrow's forecast data, show everything in light blue
    if (isTomorrow) {
      return "#bfdbfe"; // Light blue for all tomorrow's bars
    }

    const timeHour = parseInt(time.split(":")[0], 10);
    const timeMinute = parseInt(time.split(":")[1], 10);
    const currentDate = new Date();
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();

    // Calculate the current 30-minute block
    const currentBlock = currentMinute < 30 ? 0 : 30;
    
    // Only highlight if both hour and minute block match exactly
    if (timeHour === currentHour && timeMinute === currentBlock) {
      // Use the real-time Firebase value for the specific area
      return getColorFromOccupancy(realTimeOccupancy[areaKey]);
    } else if (timeHour < currentHour || (timeHour === currentHour && timeMinute < currentBlock)) {
      return "#4285F4"; // Dark blue for past
    } else {
      return "#bfdbfe"; // Light blue for future
    }
  };

  // Weather icon
  const getWeatherIcon = (condition) => {
    if (!condition) return <WiDaySunny className="text-yellow-500" />;
    const code = condition.code;
    if (code === 1000) return <WiDaySunny className="text-yellow-500" />;
    if (code === 1003) return <WiCloudy className="text-gray-500" />;
    if (code >= 1063 && code < 1200) return <WiRain className="text-blue-500" />;
    if (code >= 1200 && code < 1300) return <WiSnow className="text-blue-300" />;
    return <WiDaySunny className="text-yellow-500" />;
  };

  // Prepare data for bar chart
  const getAreaData = (areaKey) => {
    return occupancyData.map((entry) => ({
      time: entry.time,
      occupancy: entry[areaKey]
    }));
  };

  // Wrap getAreaData so we can optionally use tomorrow's data for the first card
  const getAreaDataWrapped = (areaKey) => {
    if (isTomorrow) {
      return occupancyDataTomorrow.map((entry) => ({
        time: entry.time,
        occupancy: entry[areaKey]
      }));
    }

    // Get current time block
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentMinute = now.getMinutes() < 30 ? "00" : "30";
    const currentTimeBlock = `${currentHour}:${currentMinute}`;

    return occupancyData.map((entry) => ({
      time: entry.time,
      occupancy: entry.time === currentTimeBlock ? realTimeOccupancy[areaKey] : entry[areaKey]
    }));
  };

  // Renders 6 Occupancy Cards
  const renderCards = (isMobile) => (
    <div
      className={
        isMobile
          ? "w-full max-w-md space-y-4"
          : "grid grid-cols-2 gap-2 auto-rows-max"
      }
    >
      {[
        { title: "KTH LIBRARY", key: "main", id: "first" },
        { title: "South-East Gallery", key: "southEast", id: "second" },
        { title: "Newton", key: "newton", id: "third" },
        { title: "South Gallery", key: "south", id: "fourth" },
        { title: "Ångdomen", key: "angdomen", id: "fifth" },
        { title: "North Gallery", key: "north", id: "sixth" }
      ].map(({ title, key, id }, idx) => (
        <OccupancyCard
          key={id}
          title={title}
          occupancy={realTimeOccupancy[key]}
          data={getAreaDataWrapped(key)}
          onHover={() => !isMobile && setHoveredCard(id)}
          onLeave={() => !isMobile && setHoveredCard(null)}
          getBarColor={getBarColor}
          getColorFromOccupancy={getColorFromOccupancy}
          isMobile={isMobile}
          areaKey={key}
        />
      ))}
    </div>
  );

  // For desktop only: change image on hover
  const getImageSrc = () => {
    if (!isMobile) {
      if (hoveredCard === "first") return "/2.png";
      if (hoveredCard === "second") return "/3.png";
      if (hoveredCard === "third") return "/7.png"; // Changed to Newton's image
      if (hoveredCard === "fourth") return "/5.png";
      if (hoveredCard === "fifth") return "/6.png";
      if (hoveredCard === "sixth") return "/4.png"; // Changed to North Gallery's image
    }
    return "/1.png";
  };

  // MOBILE layout
  if (isMobile) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          KTH Library Seat Prediction
        </h1>
        <p className="text-center text-gray-600 mb-4 px-4">
          This project is a serverless application to predict the seating at the KTH library.
          Learn more{" "}
          <a
            href="https://www.kth.se/en/biblioteket/anvanda-biblioteket/oppettider-kontakt/besokare-i-realtid-1.1078198"
            className="text-blue-500 underline"
          >
            here
          </a>
          .
        </p>

        {/* Main white container wrapping all content */}
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-4 mb-4">
          {/* NEW: Dynamic title with date for mobile */}
          <div className="mb-6">
            <div className="flex items-start gap-4">
              <button
                onClick={() => setIsTomorrow(!isTomorrow)}
                className="w-8 h-8 bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors shrink-0 text-sm"
                aria-label="Toggle Forecast"
              >
                {isTomorrow ? "←" : "→"}
              </button>

              <div className="text-left">
                <h2 className="text-xl font-bold text-gray-800">
                  {isTomorrow ? 'Tomorrow\'s Forecast' : 'Today\'s Occupancy'}
                </h2>
                <p className="text-gray-600 mt-1 text-sm">
                  {getFormattedDate(isTomorrow ? 1 : 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Floor plan image */}
          <div className="mb-6">
            <img
              src={getImageSrc()}
              alt="Floor plan"
              className="w-full h-auto rounded-lg"
            />
          </div>

          {/* Weather + exams countdown */}
          {weather && (
            <div className="mb-6 flex flex-col gap-2">
              <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg shadow-md">
                <div className="text-5xl">{getWeatherIcon(weather.condition)}</div>
                <div className="text-gray-800">
                  <p className="text-xl font-semibold">{weather.temp_c}°C</p>
                  <p className="text-sm">{weather.condition?.text}</p>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-md text-center flex flex-col gap-1">
                <p className="text-lg font-bold text-gray-800">
                  Days until exams: <span className="text-blue-600">10</span>
                </p>
                {commitTime && (
                  <p className="text-xs text-gray-400">
                    Last updated: {commitTime}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Cards */}
          {renderCards(true)}
        </div>

        {/* Real vs Predicted - now outside the main container */}
        <OccupancyComparison isMobile={isMobile} />
      </div>
    );
  }

  // DESKTOP layout
  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">
        KTH Library Seat Prediction
      </h1>
      <p className="text-center text-gray-600 mb-4">
        This project is a serverless application to predict the seating at the KTH library.
        Learn more{" "}
        <a
          href="https://www.kth.se/en/biblioteket/anvanda-biblioteket/oppettider-kontakt/besokare-i-realtid-1.1078198"
          className="text-blue-500 underline"
        >
          here
        </a>
        {" "}and{" "}
        <a
          href="https://www.kth.se/en/biblioteket/anvanda-biblioteket/oppettider-kontakt/oppettider-och-kontakt"
          className="text-blue-500 underline"
        >
          here
        </a>
        .
      </p>
        

      <div className="bg-white rounded-xl shadow-2xl p-4 w-full max-w-[1200px]">
        {/* NEW: Flex container for button and title */}
        <div className="mb-6 flex items-center gap-6">
          <button
            onClick={() => setIsTomorrow(!isTomorrow)}
            className="w-10 h-10 bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-colors shrink-0"
            aria-label="Toggle Forecast"
          >
            {isTomorrow ? "←" : "→"}
          </button>

          <div className="text-left">
            <h2 className="text-2xl font-bold text-gray-800">
              {isTomorrow ? 'Tomorrow\'s Forecast' : 'Today\'s Occupancy'}
            </h2>
            <p className="text-gray-600 mt-1">
              {getFormattedDate(isTomorrow ? 1 : 0)}
            </p>
          </div>
        </div>

        <div className="flex flex-row items-center justify-center gap-6">
          {/* 6 Occupancy Cards */}
          {renderCards(false)}

          {/* Floor plan, weather, exams countdown */}
          <div className="flex flex-col items-center w-[500px]">
            <img
              src={getImageSrc()}
              alt="Floor plan"
              className="w-full h-auto object-cover rounded-lg"
            />
            {weather && (
              <div className="flex items-center gap-4 mt-4 p-4 bg-white/50 backdrop-blur-sm rounded-lg">
                <div className="text-7xl">{getWeatherIcon(weather.condition)}</div>
                <div className="text-gray-800">
                  <p className="text-2xl font-semibold">{weather.temp_c}°C</p>
                  <p className="text-sm">{weather.condition?.text}</p>
                </div>
              </div>
            )}
            <div className="mt-0 p-4 bg-white/50 backdrop-blur-sm rounded-lg w-full text-center flex flex-col gap-1">
              <p className="text-xl font-bold text-gray-800">
                Days until exams: <span className="text-blue-600">10</span>
              </p>
              {commitTime && (
                <p className="text-xs text-gray-400">
                  Last updated: {commitTime}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Occupancy Comparison below */}
      <OccupancyComparison isMobile={isMobile} />
    </div>
  );
};

export default React.memo(LibraryOccupancy);
