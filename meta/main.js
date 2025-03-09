import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

let data = [];
let commits = [];
let xScale, yScale; // Make scales globally accessible
let brushSelection = null;

const width = 1000;
const height = 600;

async function loadData() {
  data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: parseFloat(row.line) || 0,
    depth: parseFloat(row.depth) || 0,
    length: parseFloat(row.length) || 0,
    file: row.file,
    author: row.author,
    date: row.date ? new Date(row.date) : null,
    datetime: row.datetime ? new Date(row.datetime) : null,
  }));

  displayStats();
  createScatterplot();
}

function processCommits() {
  commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;

      if (!(datetime instanceof Date) || isNaN(datetime)) {
        datetime = new Date(`${date}T${time}${timezone || ""}`);
      }

      let commitObj = {
        id: commit,
        url: `https://github.com/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(commitObj, "lines", {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return commitObj;
    });
}

function displayStats() {
  processCommits();

  const statsContainer = d3
    .select("#stats")
    .append("div")
    .attr("class", "summary-container");

  const stats = [
    { label: "Commits", value: commits.length },
    { label: "Files", value: new Set(data.map((d) => d.file)).size },
    { label: "Total LOC", value: data.length },
    { label: "Max Depth", value: d3.max(data, (d) => d.depth) },
    { label: "Longest Line", value: d3.max(data, (d) => d.length) },
    { label: "Max Lines", value: d3.max(d3.rollups(data, (v) => v.length, (d) => d.file), (d) => d[1]) },
  ];

  statsContainer.append("h2").attr("class", "summary-title").text("Summary");

  const statItems = statsContainer
    .append("div")
    .attr("class", "summary-stats")
    .selectAll("div")
    .data(stats)
    .enter()
    .append("div")
    .attr("class", "stat-item");

  statItems.append("span").attr("class", "stat-label").text((d) => d.label.toUpperCase());

  statItems.append("span").attr("class", "stat-value").text((d) => d.value);
}

function isCommitSelected(commit) {
    if (!brushSelection) return false;
    const [[x0, y0], [x1, y1]] = brushSelection;
    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function updateSelectionCount() {
    const selectedCommits = brushSelection
        ? commits.filter(isCommitSelected)
        : [];

    const countElement = document.getElementById('selection-count');
    countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;

    return selectedCommits;
}

function updateLanguageBreakdown() {
    const selectedCommits = brushSelection
        ? commits.filter(isCommitSelected)
        : [];
    const container = document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
        container.innerHTML = '';
        return;
    }

    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap(d => d.lines);

    // Use d3.rollup to count lines per language
    const breakdown = d3.rollup(
        lines,
        v => v.length,
        d => d.type
    );

    // Sort languages by line count descending
    const sortedEntries = Array.from(breakdown.entries())
        .sort(([,a], [,b]) => b - a);

    // Update DOM with breakdown
    container.innerHTML = '';
    
    for (const [language, count] of sortedEntries) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1~%')(proportion);
        
        container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
    }

    return breakdown;
}


function createScatterplot() {
    processCommits();
  
    const margin = { top: 10, right: 10, bottom: 30, left: 50 };
    const usableArea = {
      top: margin.top,
      right: width - margin.right,
      bottom: height - margin.bottom,
      left: margin.left,
      width: width - margin.left - margin.right,
      height: height - margin.top - margin.bottom,
    };
  
    const svg = d3
      .select("#chart")
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("overflow", "visible");
  
    // Initialize global scales
    xScale = d3
      .scaleTime()
      .domain(d3.extent(commits, (d) => d.datetime))
      .range([usableArea.left, usableArea.right])
      .nice();
  
    yScale = d3.scaleLinear()
      .domain([0, 24])
      .range([usableArea.bottom, usableArea.top]);
  
    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  
    // Add gridlines
    const gridlines = svg
      .append("g")
      .attr("class", "gridlines")
      .attr("transform", `translate(${usableArea.left}, 0)`);
  
    gridlines.call(d3.axisLeft(yScale).tickFormat("").tickSize(-usableArea.width));
  
    // Add axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    svg
      .append("g")
      .attr("transform", `translate(0, ${usableArea.bottom})`)
      .call(xAxis);
  
    const yAxis = d3
      .axisLeft(yScale)
      .tickFormat((d) => String(d % 24).padStart(2, "0") + ":00");
  
    svg
      .append("g")
      .attr("transform", `translate(${usableArea.left}, 0)`)
      .call(yAxis);
  
    // Add dots
    const dots = svg
      .append("g")
      .attr("class", "dots")
      .selectAll("circle")
      .data(sortedCommits)
      .join("circle")
      .attr("cx", (d) => xScale(d.datetime))
      .attr("cy", (d) => yScale(d.hourFrac))
      .attr("r", (d) => rScale(d.totalLines))
      .attr("class", "dot")
      .style("fill", "steelblue")
      .style("fill-opacity", 0.7)
      .on("mouseenter", function(event, commit) {
        d3.select(this).style("fill-opacity", 1);
        updateTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
      })
      .on("mousemove", updateTooltipPosition)
      .on("mouseleave", function() {
        d3.select(this).style("fill-opacity", 0.7);
        updateTooltipVisibility(false);
      });

    // Add brush
    const brush = d3.brush()
      .extent([[usableArea.left, usableArea.top], [usableArea.right, usableArea.bottom]])
      .on("start brush end", brushed);

    svg.append("g")
      .attr("class", "brush")
      .call(brush);

    // Brush handler
    function brushed(event) {
        brushSelection = event.selection;
        
        if (!brushSelection) {
            dots.style("fill", "steelblue");
            updateSelectionCount();
            updateLanguageBreakdown();
            return;
        }

        const [[x0, y0], [x1, y1]] = brushSelection;

        dots.style("fill", d => {
            const x = xScale(d.datetime);
            const y = yScale(d.hourFrac);
            return x >= x0 && x <= x1 && y >= y0 && y <= y1 
                ? "#ab90e9" 
                : "steelblue";
        });

        updateSelectionCount();
        updateLanguageBreakdown();
    }

    // Ensure dots stay on top
    d3.select(svg.node()).selectAll('.dots, .overlay ~ *').raise();
}
  

function updateTooltipContent(commit) {
  const link = document.getElementById("commit-link");
  const date = document.getElementById("commit-date");
  const time = document.getElementById("commit-time");
  const author = document.getElementById("commit-author");
  const lines = document.getElementById("commit-lines");

  if (Object.keys(commit).length === 0) {
    link.href = "";
    link.textContent = "";
    date.textContent = "";
    time.textContent = "";
    author.textContent = "";
    lines.textContent = "";
    return;
  }

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString("en", { dateStyle: "full" });
  time.textContent = commit.datetime?.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById("commit-tooltip");
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  let posX = event.clientX + 10;
  let posY = event.clientY + 10;

  // Ensure tooltip doesn't overflow on the right
  if (posX + tooltipWidth > windowWidth) {
    posX = event.clientX - tooltipWidth - 10;
  }

  // Ensure tooltip doesn't overflow at the bottom
  if (posY + tooltipHeight > windowHeight) {
    posY = event.clientY - tooltipHeight - 10;
  }

  tooltip.style.left = `${posX}px`;
  tooltip.style.top = `${posY}px`;
}

function updateTooltipVisibility(visible) {
  const tooltip = document.getElementById("commit-tooltip");
  tooltip.style.display = visible ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
});
