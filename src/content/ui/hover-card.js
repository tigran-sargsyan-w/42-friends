/**
 * @file hover-card.js
 * @description Profile hover card component shown on friend avatar hover.
 *
 * Displays detailed friend information including name, login, avatar, and level
 * in a floating card that follows the cursor.
 */

import { CSS_CLASSES } from "../constants.js";
import { getMainCursusInfo } from "../utils.js";

/**
 * Attaches a profile hover card to an element.
 *
 * @param {HTMLElement} targetElement - Element to attach hover card to
 * @param {string} friend - Friend login
 * @param {Object} friendObject - Friend profile data from API
 * @returns {HTMLElement} The created hover card element
 */
export function addProfileHoverCard(targetElement, friend, friendObject) {
    const { cursusLevel } = getMainCursusInfo(friendObject);
    const fullName = friendObject.usual_full_name || friendObject.displayname || friend;
    const imageUrl = friendObject.image?.link || "";

    const card = document.createElement("div");
    card.className = CSS_CLASSES.hoverCard;

    card.innerHTML = `
        <div class="tf-hover-card__header">
            <div class="tf-hover-card__avatar" style="background-image:url('${imageUrl}');"></div>
            <div class="tf-hover-card__info">
                <div class="tf-hover-card__name">${fullName}</div>
                <div class="tf-hover-card__login">${friend}</div>
            </div>
        </div>
        <div class="tf-hover-card__stats">
            <span class="tf-hover-card__label">level</span>
            <span class="tf-hover-card__value">${cursusLevel}</span>
        </div>
    `;

    document.body.appendChild(card);

    /**
     * Positions the card near the cursor, adjusting for viewport edges.
     */
    function placeCard(event) {
        const offsetX = 16;
        const offsetY = 16;
        const cardWidth = 300;
        const estimatedHeight = 140;

        let left = event.clientX + offsetX;
        let top = event.clientY + offsetY;

        // Prevent overflow on right edge
        if (left + cardWidth > window.innerWidth - 12) {
            left = event.clientX - cardWidth - 12;
        }

        // Prevent overflow on bottom edge
        if (top + estimatedHeight > window.innerHeight - 12) {
            top = event.clientY - estimatedHeight - 12;
        }

        card.style.left = `${Math.max(8, left)}px`;
        card.style.top = `${Math.max(8, top)}px`;
    }

    const onMouseEnter = (event) => {
        card.style.display = "block";
        placeCard(event);
    };

    const onMouseMove = (event) => {
        placeCard(event);
    };

    const onMouseLeave = () => {
        card.style.display = "none";
    };

    targetElement.addEventListener("mouseenter", onMouseEnter);
    targetElement.addEventListener("mousemove", onMouseMove);
    targetElement.addEventListener("mouseleave", onMouseLeave);

    return card;
}
