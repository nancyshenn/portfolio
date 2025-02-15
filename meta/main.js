// Declare an array to store the CSV data
let data = [];

// Function to load and process CSV data
async function loadData() {
    try {
        data = await d3.csv('loc.csv', (row) => ({
            ...row,
            line: +row.line, // Convert to Number
            depth: +row.depth,
            length: +row.length,
            date: new Date(row.date + 'T00:00' + row.timezone), // Convert to Date
            datetime: new Date(row.datetime), // Convert datetime
        }));

        displayData(data); // Call function to display the data
    } catch (error) {
        console.error("Error loading CSV file:", error);
    }
}

// Function to display data in a table
function displayData(data) {
    const outputDiv = d3.select("#csv-output");

    // Clear any existing table
    outputDiv.html("");

    if (data.length === 0) {
        outputDiv.append("p").text("No data available.");
        return;
    }

    // Create table elements
    const table = outputDiv.append("table").attr("border", "1").style("width", "100%");
    const thead = table.append("thead");
    const tbody = table.append("tbody");

    // Extract column names dynamically
    const columns = Object.keys(data[0]);

    // Append header row
    thead.append("tr")
        .selectAll("th")
        .data(columns)
        .enter()
        .append("th")
        .text(d => d)
        .style("background-color", "#4092d5")
        .style("color", "white")
        .style("padding", "10px")
        .style("text-align", "left");

    // Append data rows
    data.forEach(row => {
        const tr = tbody.append("tr");
        columns.forEach(column => {
            tr.append("td")
                .text(row[column])
                .style("padding", "8px")
                .style("border", "1px solid #ddd");
        });
    });
}

// Load data when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
});
