function specificDaysFilter(data, chosenDays) {
  const result = {};

  for (const course in data) {
    result[course] = {};

    for (const sessionType in data[course]) {
      //To skip empty session types
      if (data[course][sessionType].length != 0) {
        // Filter session GROUPS based on chosen days
        // A group is valid if ALL sessions in the group are on chosen days
        result[course][sessionType] = data[course][sessionType].filter(sessionGroup => {
          // sessionGroup is an array of sessions (e.g., [MonSession, WedSession])
          if (Array.isArray(sessionGroup)) {
            return sessionGroup.every(session => chosenDays.includes(session.day));
          } else {
            // Fallback for old data format
            return chosenDays.includes(sessionGroup.day);
          }
        });
        // If there are no sessions on the chosen days, return an error message
        if (result[course][sessionType].length == 0) {
          return "Not possible for " + course + " on " + chosenDays;
        }
      }
    }
  }
  return result;
}

//Allows the user to filter out specific sessions from the schedule
function removeSessionsFilter(data, sessionsToRemove) {
  const result = {};

  for (const [course, sessions] of Object.entries(data)) {
    if (!sessionsToRemove[course]) {
      result[course] = { ...sessions };
      continue;
    }

    const filteredSessions = {};
    const courseRemovals = sessionsToRemove[course] || {};
    console.log(courseRemovals);
    for (const [sessionType, classes] of Object.entries(sessions)) {
      const classesToRemove = courseRemovals[sessionType] || [];
      console.log(classesToRemove);
      console.log(sessionType);
      // Filter session GROUPS - remove if the group's class name is in the removal list
      filteredSessions[sessionType] = classes.filter(sessionGroup => {
        // sessionGroup is an array of sessions (e.g., [MonSession, WedSession])
        if (Array.isArray(sessionGroup) && sessionGroup.length > 0) {
          // Use the first session's class name to identify the group
          const groupClassName = sessionGroup[0].class;
          return !classesToRemove.includes(groupClassName);
        } else if (sessionGroup && sessionGroup.class) {
          // Fallback for old data format
          return !classesToRemove.includes(sessionGroup.class);
        }
        return true; // Keep if structure is unexpected
      });
    }

    result[course] = filteredSessions;
  }
  console.log(data);
  console.log(result);
  return result;
}