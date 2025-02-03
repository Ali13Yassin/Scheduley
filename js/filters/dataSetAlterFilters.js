function specificDaysFilter(data, chosenDays) {
  const result = {};

  for (const course in data) {
    result[course] = {};

    for (const sessionType in data[course]) {
      //To skip empty session types
      if (data[course][sessionType].length != 0) {
        // Filter sessions based on chosen days
        result[course][sessionType] = data[course][sessionType].filter(session =>
          chosenDays.includes(session.day)
        );
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
      filteredSessions[sessionType] = classes.filter(
        session => !classesToRemove.includes(session.class)
      );
    }

    result[course] = filteredSessions;
  }
  console.log(data);
  console.log(result);
  return result;
}