'use client';

// Data processing utilities for tracking analytics
export class DataProcessor {
  
  static preprocessTrackingData(rawData) {
    if (!rawData || rawData.length === 0) {
      return {
        raw: [],
        unique: [],
        summary: {},
        personActivities: {},
        zoneAnalysis: {},
        temporalData: {}
      };
    }

    // Clean and validate data
    const cleanData = rawData.filter(row => 
      row.person_id && 
      row.activity && 
      row.timestamp
    );

    // Create unique person-activity combinations
    const uniqueActivities = this.deduplicateActivities(cleanData);
    
    // Generate comprehensive summary
    const summary = this.generateSummary(cleanData, uniqueActivities);
    
    // Person-based analysis
    const personActivities = this.analyzePersonActivities(cleanData);
    
    // Zone-based analysis
    const zoneAnalysis = this.analyzeZones(cleanData);
    
    // Temporal analysis
    const temporalData = this.analyzeTemporalPatterns(cleanData);

    return {
      raw: cleanData,
      unique: uniqueActivities,
      summary,
      personActivities,
      zoneAnalysis,
      temporalData
    };
  }

  static deduplicateActivities(data) {
    const uniqueMap = new Map();
    
    data.forEach(row => {
      const key = `${row.person_id}_${row.activity}_${row.zone_id}`;
      
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, {
          person_id: row.person_id,
          activity: row.activity,
          zone_id: row.zone_id,
          first_seen: row.timestamp,
          last_seen: row.timestamp,
          frame_count: 1,
          duration_seconds: 0
        });
      } else {
        const existing = uniqueMap.get(key);
        existing.last_seen = row.timestamp;
        existing.frame_count++;
        
        // Calculate duration if we have frame time data
        if (row.frame_time_sec) {
          const startTime = parseFloat(row.frame_time_sec) || 0;
          existing.duration_seconds = Math.max(existing.duration_seconds, startTime);
        }
      }
    });

    return Array.from(uniqueMap.values());
  }

  static generateSummary(rawData, uniqueData) {
    const totalFrames = new Set(rawData.map(row => row.frame)).size;
    const totalPersons = new Set(rawData.map(row => row.person_id)).size;
    const totalZones = new Set(rawData.map(row => row.zone_id)).size;
    
    // Activity counts (deduplicated)
    const activityCounts = {};
    uniqueData.forEach(item => {
      activityCounts[item.activity] = (activityCounts[item.activity] || 0) + 1;
    });
    
    // Zone occupation
    const zoneOccupation = {};
    uniqueData.forEach(item => {
      const zone = `Zone ${item.zone_id}`;
      zoneOccupation[zone] = (zoneOccupation[zone] || 0) + 1;
    });
    
    // Time-based metrics
    const timeRange = this.getTimeRange(rawData);
    
    return {
      totalFrames,
      totalPersons,
      totalZones,
      totalRawRecords: rawData.length,
      totalUniqueActivities: uniqueData.length,
      activityCounts,
      zoneOccupation,
      timeRange,
      averageActivitiesPerPerson: (uniqueData.length / totalPersons).toFixed(2)
    };
  }

  static analyzePersonActivities(data) {
    const personMap = {};
    
    data.forEach(row => {
      const personId = row.person_id;
      
      if (!personMap[personId]) {
        personMap[personId] = {
          person_id: personId,
          activities: new Set(),
          zones: new Set(),
          total_frames: 0,
          first_seen: row.timestamp,
          last_seen: row.timestamp
        };
      }
      
      const person = personMap[personId];
      person.activities.add(row.activity);
      person.zones.add(row.zone_id);
      person.total_frames++;
      person.last_seen = row.timestamp;
    });

    // Convert Sets to Arrays for JSON serialization
    Object.values(personMap).forEach(person => {
      person.activities = Array.from(person.activities);
      person.zones = Array.from(person.zones);
      person.activity_count = person.activities.length;
      person.zone_count = person.zones.length;
    });

    return personMap;
  }

  static analyzeZones(data) {
    const zoneMap = {};
    
    data.forEach(row => {
      const zoneId = row.zone_id;
      
      if (!zoneMap[zoneId]) {
        zoneMap[zoneId] = {
          zone_id: zoneId,
          unique_persons: new Set(),
          activities: {},
          total_detections: 0
        };
      }
      
      const zone = zoneMap[zoneId];
      zone.unique_persons.add(row.person_id);
      zone.activities[row.activity] = (zone.activities[row.activity] || 0) + 1;
      zone.total_detections++;
    });

    // Convert Sets to numbers and calculate percentages
    Object.values(zoneMap).forEach(zone => {
      zone.unique_person_count = zone.unique_persons.size;
      zone.unique_persons = Array.from(zone.unique_persons); // For debugging
      
      // Calculate activity percentages in this zone
      zone.activity_percentages = {};
      Object.entries(zone.activities).forEach(([activity, count]) => {
        zone.activity_percentages[activity] = ((count / zone.total_detections) * 100).toFixed(1);
      });
    });

    return zoneMap;
  }

  static analyzeTemporalPatterns(data) {
    if (data.length === 0) return {};
    
    // Group by time intervals (e.g., every 5 seconds)
    const timeIntervals = {};
    const intervalSize = 5; // seconds
    
    data.forEach(row => {
      if (row.frame_time_sec) {
        const timeSlot = Math.floor(parseFloat(row.frame_time_sec) / intervalSize) * intervalSize;
        
        if (!timeIntervals[timeSlot]) {
          timeIntervals[timeSlot] = {
            time_start: timeSlot,
            time_end: timeSlot + intervalSize,
            unique_persons: new Set(),
            activities: {},
            zones: {}
          };
        }
        
        const interval = timeIntervals[timeSlot];
        interval.unique_persons.add(row.person_id);
        interval.activities[row.activity] = (interval.activities[row.activity] || 0) + 1;
        interval.zones[row.zone_id] = (interval.zones[row.zone_id] || 0) + 1;
      }
    });

    // Convert to arrays and calculate metrics
    const sortedIntervals = Object.values(timeIntervals)
      .map(interval => ({
        ...interval,
        person_count: interval.unique_persons.size,
        unique_persons: Array.from(interval.unique_persons)
      }))
      .sort((a, b) => a.time_start - b.time_start);

    return {
      intervals: sortedIntervals,
      total_duration: sortedIntervals.length * intervalSize,
      peak_occupancy: Math.max(...sortedIntervals.map(i => i.person_count), 0),
      average_occupancy: (sortedIntervals.reduce((sum, i) => sum + i.person_count, 0) / sortedIntervals.length).toFixed(1)
    };
  }

  static getTimeRange(data) {
    if (data.length === 0) return {};
    
    const timestamps = data.map(row => new Date(row.timestamp)).filter(d => !isNaN(d));
    if (timestamps.length === 0) return {};
    
    const earliest = new Date(Math.min(...timestamps));
    const latest = new Date(Math.max(...timestamps));
    
    return {
      start: earliest.toISOString(),
      end: latest.toISOString(),
      duration_ms: latest - earliest,
      duration_seconds: Math.round((latest - earliest) / 1000)
    };
  }

  // Utility method to get activity insights
  static getActivityInsights(processedData) {
    const { summary, personActivities, zoneAnalysis } = processedData;
    
    const insights = [];
    
    // Most common activity
    const topActivity = Object.entries(summary.activityCounts)
      .sort(([,a], [,b]) => b - a)[0];
    if (topActivity) {
      insights.push(`Most common activity: ${topActivity[0]} (${topActivity[1]} people)`);
    }
    
    // Most active zone
    const topZone = Object.entries(summary.zoneOccupation)
      .sort(([,a], [,b]) => b - a)[0];
    if (topZone) {
      insights.push(`Most active zone: ${topZone[0]} (${topZone[1]} activities)`);
    }
    
    // Activity diversity
    const avgActivitiesPerPerson = summary.averageActivitiesPerPerson;
    insights.push(`Average activities per person: ${avgActivitiesPerPerson}`);
    
    // Multi-zone people
    const multiZonePeople = Object.values(personActivities)
      .filter(person => person.zone_count > 1).length;
    insights.push(`People detected in multiple zones: ${multiZonePeople}`);
    
    return insights;
  }
}