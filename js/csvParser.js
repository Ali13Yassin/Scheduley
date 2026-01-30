export function parseCSVContent(csvContent) {
    const rows = csvContent.split("\n").map(row => row.trim());
    const headers = rows[0].split(",").map(header => header.trim());
    const courses = {};
    const courseDetails = {};

    for (let i = 1; i < rows.length; i++) {
        const values = rows[i].split(",").map(value => value.trim());

        if (values.length !== headers.length) {
            console.warn(`Skipping row ${i} due to mismatched columns`);
            continue;
        }

        const entry = {};
        headers.forEach((header, index) => {
            entry[header] = values[index];
        });

        const courseCode = entry['Course code'];
        if (courseCode) {
            if (!courseDetails[courseCode]) {
                courseDetails[courseCode] = {
                    courseName: entry['Course name'],
                    creditHours: entry['Credit hours'],
                    level: entry['Level'],
                    program: entry['program']
                };
            }
        }

        const { course, class: className, day, start, end, location, lecturer, type } = entry;

        if (!course || !type) {
            continue; // Skip without warning for empty lines to be cleaner
        }

        if (!courses[course]) {
            courses[course] = { lectures: [], labs: [], tutorials: [] };
        }

        // --- Logic to be modified starts here ---
        const session = { course, class: className, day, start, end, location, lecturer };

        // Helper to check for splitters - handles BOTH raw HTML tags AND escaped HTML entities
        const hasSplitter = (str) => typeof str === 'string' && (
            str.includes("<br/>") || str.includes("<br>") ||
            str.includes("&lt;br/&gt;") || str.includes("&lt;br&gt;")
        );
        const splitVal = (str) => {
            if (!str) return [];
            // Split by <br/>, <br>, &lt;br/&gt;, or &lt;br&gt; and trim
            return str.split(/<br\/?>|&lt;br\/?&gt;/i).map(s => s.trim()).filter(s => s.length > 0);
        };

        let sessionsToAdd = [];

        // Check if any critical field has a splitter
        if (hasSplitter(day) || hasSplitter(start) || hasSplitter(end) || hasSplitter(location)) {
            console.log(`[CSVParser] Found splitter in course ${course}:`, { day, start, end, location });
            const days = hasSplitter(day) ? splitVal(day) : [day];
            const starts = hasSplitter(start) ? splitVal(start) : [start];
            const ends = hasSplitter(end) ? splitVal(end) : [end];
            const locs = hasSplitter(location) ? splitVal(location) : [location];

            // Determine the maximum length of splits to iterate over
            // We assume consistent numbering if splits exist, otherwise reuse the single value
            const maxLen = Math.max(days.length, starts.length, ends.length, locs.length);

            for (let k = 0; k < maxLen; k++) {
                // Use the k-th element if available, otherwise fallback to the last valid element or the single value
                // In truly well-formed data with splits, they should align.
                // If "SUN<br>TUE" but only "09:00", we assume 09:00 applies to both.
                // If "09:00<br>10:00" and "SUN", we assume SUN applies to both.

                const d = days[k] !== undefined ? days[k] : (days.length === 1 ? days[0] : days[days.length - 1]);
                const s = starts[k] !== undefined ? starts[k] : (starts.length === 1 ? starts[0] : starts[starts.length - 1]);
                const e = ends[k] !== undefined ? ends[k] : (ends.length === 1 ? ends[0] : ends[ends.length - 1]);
                const l = locs[k] !== undefined ? locs[k] : (locs.length === 1 ? locs[0] : locs[locs.length - 1]);

                console.log(`[CSVParser] Created split session:`, { d, s, e, l });
                sessionsToAdd.push({
                    course,
                    class: className,
                    day: d,
                    start: s,
                    end: e,
                    location: l,
                    lecturer // Lecturer is usually the same for all splits
                });
            }
        } else {
            // logging normal sessions might be too noisy, enable if needed
            // console.log(`[CSVParser] Normal session:`, session);
            sessionsToAdd.push(session);
        }

        if (sessionsToAdd.length > 0) {
            // Push the sessions as a GROUP (Array) to ensure they are selected together
            // If it's a normal session, it will be an array of length 1: [session]
            // If it's a split session, it will be: [part1, part2]
            switch (type) {
                case "LEC":
                    courses[course].lectures.push(sessionsToAdd);
                    break;
                case "LAB":
                    courses[course].labs.push(sessionsToAdd);
                    break;
                case "TUT":
                    courses[course].tutorials.push(sessionsToAdd);
                    break;
                default:
                    console.warn(`Unrecognized type '${type}' at row ${i}`);
            }
        }
    }

    return { courses, courseDetails };
}
