import { fetchJSON, renderProjects } from '../global.js';

(async function () {
    const projects = await fetchJSON('../lib/projects.json');
    const projectsContainer = document.querySelector('.projects');

    if (projectsContainer) {
        renderProjects(projects, projectsContainer, 'h2');
    } else {
        console.error("Error: No container found for displaying projects.");
    }

    const projectTitle = document.querySelector('.projects-title');
    if (projectTitle) {
        projectTitle.textContent = `Projects (${projects.length})`;
    }
})();
