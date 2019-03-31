
-- DROP VIEW vw_battery_data 
CREATE OR REPLACE VIEW vw_battery_data AS
SELECT last("time", "time") AS "time", last(battery, "time") AS battery, location, 'netatmo' AS device
FROM netatmo
WHERE time > NOW() - interval '1 hour' 
GROUP BY location
UNION
SELECT last("time", "time") AS "time", last(battery, "time") AS battery, garden_sensor_plant.sensor_label as location, 'garden' AS device
FROM garden_sensor
INNER JOIN garden_sensor_plant ON garden_sensor.address = garden_sensor_plant.address 
WHERE time > NOW() - interval '1 hour' 
GROUP BY garden_sensor_plant.sensor_label
