/**
 * ═══════════════════════════════════════════════════════
 * BG Energy Dashboard — Weather Data Service
 * 
 * Client-side service for fetching meteorological data 
 * from Open-Meteo API.
 * ═══════════════════════════════════════════════════════
 */

/**
 * Fetch hourly historical weather data.
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 * @param {Date} startDate 
 * @param {Date} endDate 
 * @returns {Promise<Array>} Array of weather objects
 */
export async function fetchWeatherRange(lat = 42.70, lon = 23.32, startDate, endDate) {
    if (!startDate || !endDate) return [];
    
    // Format dates as YYYY-MM-DD
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${startStr}&end_date=${endStr}&hourly=temperature_2m,shortwave_radiation,cloudcover,windspeed_10m,precipitation&timezone=auto`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error("Open-Meteo fetch failed:", response.statusText);
            return [];
        }
        
        const data = await response.json();
        
        if (!data.hourly || !data.hourly.time) {
            console.warn("No hourly weather data returned for range");
            return [];
        }
        
        const results = [];
        const times = data.hourly.time;
        for (let i = 0; i < times.length; i++) {
            const temp = data.hourly.temperature_2m[i];
            const solar = data.hourly.shortwave_radiation[i];
            const wind = data.hourly.windspeed_10m[i];
            const clouds = data.hourly.cloudcover[i];
            
            results.push({
                datetime: new Date(times[i]),
                temperature: temp,
                solar_radiation: solar,
                wind_speed: wind,
                cloud_cover: clouds,
                precipitation: data.hourly.precipitation[i],
                // Computed signals for UI components
                isSunny: solar > 400 && clouds < 30,
                isExtremeTemp: temp < 5 || temp > 25,
                isHighWind: wind > 8
            });
        }
        
        return results;
    } catch (e) {
        console.error("weatherService Error: ", e);
        return [];
    }
}
