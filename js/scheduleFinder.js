importScripts('./filters/dataSetAlterFilters.js');
importScripts('./filters/postGenFilters.js');

const conflictCache = new Set();

function getConflictKey(session1, session2) {
    return [session1.course + session1.class, session2.course + session2.class].sort().join("-");
}

function timesOverlap(class1, class2) {
    if (class1.day !== class2.day) return false;
    return !(class1.end <= class2.start || class2.end <= class1.start);
}

function isValidSchedule(schedule) {
    for (let i = 0; i < schedule.length; i++) {
        for (let j = i + 1; j < schedule.length; j++) {
            const conflictKey = getConflictKey(schedule[i], schedule[j]);
            if (conflictCache.has(conflictKey)) return false;
            if (timesOverlap(schedule[i], schedule[j])) {
                conflictCache.add(conflictKey);
                return false;
            }
        }
    }
    return true;
}

// Modified to accept time limits
function generateSchedules(courses, courseDetails, currentSchedule = [], results = [], startTime, timeLimit) {
    if (courses.length === 0) {
        if (isValidSchedule(currentSchedule)) results.push([...currentSchedule]);
        return results;
    }

    const [course, ...remainingCourses] = courses;
    const { lectures = [], labs = [], tutorials = [] } = courseDetails[course];
    const lectureOptions = lectures.length ? lectures : [null];
    const labOptions = labs.length ? labs : [null];
    const tutorialOptions = tutorials.length ? tutorials : [null];

    for (const lectureTime of lectureOptions) {
        for (const labTime of labOptions) {
            for (const tutorialTime of tutorialOptions) {
                // Check time limit
                if (performance.now() - startTime > timeLimit) return results;

                const newSchedule = [...currentSchedule];
                if (lectureTime) newSchedule.push(lectureTime);
                if (labTime) newSchedule.push(labTime);
                if (tutorialTime) newSchedule.push(tutorialTime);

                if (isValidSchedule(newSchedule)) {
                    if (performance.now() - startTime > timeLimit) return results;
                    generateSchedules(remainingCourses, courseDetails, newSchedule, results, startTime, timeLimit);
                    if (performance.now() - startTime > timeLimit) return results;
                }
            }
        }
    }
    return results;
}

// Simple benchmark to estimate device performance
function runBenchmark() {
    const start = performance.now();
    let sum = 0;
    for (let i = 0; i < 1000000; i++) sum += i;
    return performance.now() - start;
}

function findSchedule(courseKeys, filterData, courseData) {
    let courseDetails = {};
    for (const courseKey of courseKeys) {
        if (courseData[courseKey]) courseDetails[courseKey] = courseData[courseKey];
    }

    // Determine time budget based on benchmark
    const benchmarkTime = runBenchmark();
    const timeBudget = 2000; // Max 2 seconds allowed
    const startTime = performance.now();
    const timeLimit = timeBudget - benchmarkTime; // Adjust based on benchmark

    // Filter the data based on the selected days
    // if (filterData.days !== "any"){
    //     courseDetails = specificDaysFilter(courseDetails, chosenDays) //TODO: Implement this function
    // ;

    if (filterData.sessionsToRemove.length !== 0) {
        courseDetails = removeSessionsFilter(courseDetails, filterData.sessionsToRemove);
    }

    // Generate schedules with dynamic time limit
    let schedules = generateSchedules(courseKeys, courseDetails, [], [], startTime, timeLimit);

    // Apply filters
    if (filterData.numOfDays !== "any") {
        schedules = numOfDaysFilter(schedules)[filterData.numOfDays];
    }
    if (filterData.gaps === "true") {
        schedules = findSchedulesWithGaps(schedules);
    }
    if (filterData.labOrTutorialAfterLecture === "true") {
        schedules = checkLabOrTutorialAfterLecture(schedules);
    }
    if (filterData.removeSingleSessionDays === "true") {
        schedules = removeSingleSessionDays(schedules);
    }
    schedules = shuffleArray(schedules);

    return schedules;
}
function shuffleArray(array) {
    let shuffledArray = [...array]; // Create a copy to avoid modifying the original array
    for (let i = shuffledArray.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1)); // Get a random index
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; // Swap elements
    }
    return shuffledArray;
}
self.onmessage = function(e) {
    const { selectedResults, filterData, coursesData } = e.data;
    try {
        const schedules = findSchedule(selectedResults, filterData, coursesData);
        const data = {
            schedules: schedules.length
        };
        trackRequest(data);
        self.postMessage({ type: 'success', schedules });
    } catch (error) {
        self.postMessage({ type: 'error', message: error.message });
    }
};
function trackRequest(data){
    const trackingUrl = 'https://script.google.com/macros/s/AKfycbxb9DgdbxyYXmDKmtHrzL3NFiJVhIecIzx-AlQAg3WH4AHycMyKTZta_T05Z1JuLdYj/exec';
      // Send the tracking data via a POST request
      fetch(trackingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })
      .then(response => response.json())
      .then(result => {
        console.log('Tracking result:', result);
      })
      .catch(error => console.error('Error tracking function call:', error));
    }
