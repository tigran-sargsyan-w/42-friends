/**
 * @file tooltip.js
 * @description Tooltip helper for showing contextual hints on hover.
 *
 * Creates a tooltip element that follows the mouse cursor when hovering
 * over the target element.
 */

import { CSS_CLASSES } from "../constants.js";

/**
 * Attaches a hover tooltip to an element.
 *
 * @param {HTMLElement} element - Element to attach tooltip to
 * @param {string} title - Tooltip text content
 * @returns {HTMLElement} The created tooltip element
 */
export function addTooltipOnHover(element, title) {
    const tooltip = document.createElement("div");
    tooltip.className = CSS_CLASSES.tooltip;
    tooltip.textContent = title;

    // Styles are in CSS, but we need position: absolute for placement
    tooltip.style.position = "absolute";
    tooltip.style.display = "none";
    document.body.appendChild(tooltip);

    const onMouseEnter = () => {
        tooltip.style.display = "block";
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + window.scrollX}px`;
        tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 6}px`;
    };

    const onMouseLeave = () => {
        tooltip.style.display = "none";
    };

    const onMouseMove = (event) => {
        tooltip.style.left = `${event.pageX + 10}px`;
        tooltip.style.top = `${event.pageY + 10}px`;
    };

    element.addEventListener("mouseenter", onMouseEnter);
    element.addEventListener("mouseleave", onMouseLeave);
    element.addEventListener("mousemove", onMouseMove);

    return tooltip;
}
