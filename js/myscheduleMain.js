import { renderSchedule } from './uiFunctions.js';
import { showAlert } from './alert.js';
const savedSchedule = localStorage.getItem('savedSchedule');
const savedColors = JSON.parse(localStorage.getItem('savedColors'));

fetch('nav.html')
    .then(response => response.text())
    .then(data => {
    document.getElementById('navbar').innerHTML = data;
});
fetch('scheduleVisuals.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('schedule-container').innerHTML = data;
        if (savedSchedule !== "" && savedSchedule !== null) {
            const schedule = JSON.parse(savedSchedule);
            renderSchedule(schedule, "schedule-container", savedColors);
        } else {
            showAlert("No schedule found", "Please make a schedule first", "scheduleFinder.html", "Find a schedule");
        }
    });
fetch('footer.html')
    .then(response => response.text())
    .then(data => {
        document.getElementById('footer').innerHTML = data;
});
function saveAsPNG() {
    let element = document.getElementById("schedule-container"); // Target element

    html2canvas(element).then(canvas => {
        let image = canvas.toDataURL("image/png");

        // Create a download link
        let link = document.createElement("a");
        link.href = image;
        link.download = "screenshot.png";
        link.click();
    });
}
document.getElementById("export-button").addEventListener("click", saveAsPNG);