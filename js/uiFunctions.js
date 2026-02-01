// Professional Schedule Calendar Rendering
// Following industry best practices for calendar UI/UX

// ===== DEBUG FLAGS =====
const DEBUG_DISABLE_DRAG = false; // Drag enabled
const DEBUG_LOCK_VERBOSE = true; // Keep verbose logging for verification

/**
 * Handle session swap with direct injection (no Jump strategy)
 * Senior Engineer approach: Always inject the new schedule variant
 * This preserves ALL current selections while only changing the swapped session
 * 
 * @param {string} courseKey - Course being swapped
 * @param {string} oldClassName - Current class name
 * @param {string} newClassName - Target class name
 * @param {HTMLElement} container - Calendar container
 * @param {Object} customColors - Color assignments
 */
function handleSwap(courseKey, oldClassName, newClassName, container, customColors) {
    console.log('[handleSwap] Starting swap:', { courseKey, oldClassName, newClassName });

    if (!window.sessionSwapper || !window.allSchedules) {
        console.error('[handleSwap] sessionSwapper or allSchedules not available');
        return;
    }

    const currentViewIndex = window.viewIndex || 0;
    const currentSchedule = window.allSchedules[currentViewIndex];

    if (!currentSchedule) {
        console.error('[handleSwap] Current schedule not found');
        return;
    }

    const sessionType = window.sessionSwapper.getSessionType(oldClassName);
    console.log('[handleSwap] Session type:', sessionType);

    // Get the new group from coursesData
    const coursesData = JSON.parse(localStorage.getItem('coursesData') || '{}');
    const courseData = coursesData[courseKey];
    if (!courseData || !courseData[sessionType]) {
        console.error('[handleSwap] Course data not found for:', courseKey, sessionType);
        return;
    }

    // Find the new group - it's an array of session objects
    const newGroup = courseData[sessionType].find(group =>
        Array.isArray(group) && group.length > 0 && group[0].class === newClassName
    );

    if (!newGroup) {
        console.error('[handleSwap] Target session group not found:', newClassName);
        return;
    }

    console.log('[handleSwap] Found new group with', newGroup.length, 'sessions');

    // Perform the swap (remove old, add new)
    const result = window.sessionSwapper.performSwap(currentSchedule, courseKey, oldClassName, newGroup);

    if (!result.success) {
        console.error('[handleSwap] Swap failed:', result.error);
        return;
    }

    const newSchedule = result.newSchedule;

    // Fix "Rearranging" issue: Sort the schedule so sessions are always in canonical order (Day -> Time)
    const dayOrder = { "SUN": 0, "MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6 };
    newSchedule.sort((a, b) => {
        const dA = dayOrder[a.day] ?? 99;
        const dB = dayOrder[b.day] ?? 99;
        if (dA !== dB) return dA - dB;
        return (a.start || "").localeCompare(b.start || "");
    });

    console.log('[handleSwap] Created new schedule with', newSchedule.length, 'sessions');

    // ALWAYS inject the new schedule (don't search for existing matches)
    // This ensures user's current selections are preserved
    window.allSchedules.push(newSchedule);
    const newViewIndex = window.allSchedules.length - 1;
    window.viewIndex = newViewIndex;
    console.log('[handleSwap] Injected at index:', newViewIndex);

    // Lockwood Logic Update (User Requested):
    // 1. If old session was locked -> UNLOCK IT (User changed their mind).
    // 2. Do NOT lock the new session (Manual locking only).
    // 3. Result: Moving any session results in an UNLOCKED session.
    if (window.scheduleApp && window.lockedGroups) {
        const oldLockKey = window.scheduleApp.getLockKey(courseKey, sessionType, oldClassName);
        // const newLockKey = window.scheduleApp.getLockKey(courseKey, sessionType, newClassName); // Not used anymore

        // Remove old lock (if it existed)
        if (window.lockedGroups.has(oldLockKey)) {
            window.lockedGroups.delete(oldLockKey);
            console.log('[handleSwap] Removed old lock (Mind Changer):', oldLockKey);
        }

        // DO NOT add new lock. Zero auto-locking.
        console.log('[handleSwap] New session remains UNLOCKED (Manual Lock Only)');
    }

    // Clear ghosts BEFORE re-render
    window.sessionSwapper.clearGhosts(container);

    // Render the new schedule directly (avoid triggering recomputeFilteredIndexes)
    // CRITICAL: Must enable Drag and Lock explicitly because we might not be in the default container context
    const renderOptions = { enableDrag: true, enableLock: true };

    if (typeof renderSchedule === 'function') {
        renderSchedule(newSchedule, container.id, customColors, renderOptions);
    } else if (window.renderSchedule) {
        window.renderSchedule(newSchedule, container.id, customColors, renderOptions);
    }

    // Update the summary display
    const totalEl = document.getElementById('total-schedules');
    const idxEl = document.getElementById('current-schedule-index');
    if (totalEl) totalEl.textContent = `Found ${window.allSchedules.length} schedules`;
    if (idxEl) idxEl.textContent = `Viewing ${newViewIndex + 1} / ${window.allSchedules.length}`;

    console.log('[handleSwap] Swap complete!');
}

export function renderSchedule(schedule, containerId, customColors = {}, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(schedule)) return;

    // Options: enable lock/drag if explicitly set OR if container has day-columns (is a schedule view)
    const hasDayColumns = !!container.querySelector('.day-column');
    const isMainScheduleView = containerId === 'schedule-details-container';
    const enableLock = options.enableLock ?? (isMainScheduleView || hasDayColumns);
    const enableDrag = options.enableDrag ?? (isMainScheduleView || hasDayColumns);

    // Clear previous blocks
    container.querySelectorAll('.class-block').forEach(b => b.remove());
    // Also clear any lingering ghosts
    container.querySelectorAll('.drop-zone-ghost').forEach(g => g.remove());

    // Tooltip setup
    const enableTooltip = ['schedule-details-container', 'schedule-container', 'course-details-container'].includes(containerId);
    const tooltipId = `class-tooltip-${containerId}`;
    let tooltip = enableTooltip ? container.querySelector(`#${tooltipId}`) : null;
    if (enableTooltip && !tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = tooltipId;
        tooltip.className = 'schedule-tooltip';
        container.appendChild(tooltip);
    }

    // Course details
    let details;
    try {
        const raw = localStorage.getItem('courseDetails');
        details = raw ? JSON.parse(raw) : {};
    } catch (e) { details = {}; }

    const DAY_START = 8;
    const PX_PER_HOUR = 65;  // Increased for more spacing

    // ===== DEBUG FLAGS =====
    // const DEBUG_DISABLE_DRAG = true; // REMOVED: Uses global flag
    // const DEBUG_LOCK_VERBOSE = true; // REMOVED: Uses global flag
    // Parse time "HH:MM" to decimal
    const parseTime = (t) => {
        if (!t) return DAY_START;
        if (typeof t === 'number') return t;
        const [h, m] = t.toString().split(':').map(Number);
        return (isNaN(h) ? DAY_START : h) + ((m || 0) / 60);
    };

    // Format as "HH:MM"
    const fmtTime = (t) => t?.toString().trim() || '';

    // Get session badge (Lec 01, Lab 02, etc)
    const getBadge = (cls) => {
        if (!cls) return '';
        const c = cls.toLowerCase();
        const num = cls.match(/\d+/)?.[0]?.padStart(2, '0') || '';
        if (c.includes('lec')) return `Lec ${num}`;
        if (c.includes('lab')) return `Lab ${num}`;
        if (c.includes('tut')) return `Tut ${num}`;
        return cls;
    };

    // Darken a hex color by amount (0-1)
    const darken = (hex, amount = 0.15) => {
        const rgb = hex.match(/\w\w/g).map(x => parseInt(x, 16));
        return '#' + rgb.map(c => Math.max(0, Math.round(c * (1 - amount))).toString(16).padStart(2, '0')).join('');
    };

    // Lighten a hex color
    const lighten = (hex, amount = 0.15) => {
        const rgb = hex.match(/\w\w/g).map(x => parseInt(x, 16));
        return '#' + rgb.map(c => Math.min(255, Math.round(c + (255 - c) * amount)).toString(16).padStart(2, '0')).join('');
    };

    schedule.forEach(session => {
        if (!session?.day) return;

        const dayCol = container.querySelector(`.day-column[data-day="${session.day}"]`);
        if (!dayCol) return;

        const start = parseTime(session.start);
        const end = parseTime(session.end);
        const duration = Math.max(end - start, 0.5);
        const top = (start - DAY_START) * PX_PER_HOUR;
        const height = Math.max(duration * PX_PER_HOUR, 35);

        const courseKey = session.course;
        const meta = details[courseKey];
        const courseName = meta?.courseName || courseKey || 'Course';
        const badge = getBadge(session.class);
        const lecturer = session.lecturer || '';
        const location = session.location || '';

        // SVG location pin icon (12x12, currentColor for proper theming)
        const locationIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0; opacity:0.9;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

        // Colors with proper contrast
        let bgColor = customColors[courseKey]?.[0] || '#D74C4C';
        let fgColor = customColors[courseKey]?.[1] || '#FFFFFF';

        // Badge: same color but darker for elegance
        const badgeBg = darken(bgColor, 0.25);
        const badgeFg = '#FFFFFF';

        // Create block
        const block = document.createElement('div');
        block.className = 'class-block';

        // Refined styling - softer, more professional
        Object.assign(block.style, {
            position: 'absolute',
            left: '3px',
            right: '3px',
            top: `${top}px`,
            height: `${height}px`,
            background: bgColor,
            color: fgColor,
            borderRadius: '6px',
            padding: '8px 10px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
            borderLeft: `3px solid ${badgeBg}`,
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        });

        // Store session data for lock/drag functionality
        block.dataset.course = session.course;
        block.dataset.class = session.class;
        block.dataset.day = session.day;
        block.dataset.start = session.start;


        // Content based on block size
        const isLarge = height >= 85;
        const isMedium = height >= 55;

        // Lock button HTML (only if lock is enabled)
        const sessionLocked = enableLock && (window.scheduleApp?.isLocked?.(session.course, session.class) || false);
        if (sessionLocked) {
            block.classList.add('locked');
            block.style.boxShadow = '0 0 0 2px #FFD700, 0 1px 3px rgba(0,0,0,0.12)';
        }

        const lockIcon = sessionLocked ? '🔒' : '🔓';
        const lockBtnHtml = enableLock
            ? `<button class="lock-btn" style="position:absolute; top:2px; right:2px; width:24px; height:24px; min-width:24px; background:rgba(255,255,255,0.9); border:none; border-radius:4px; cursor:pointer; font-size:12px; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; z-index:10;">${lockIcon}</button>`
            : '';
        const paddingRight = enableLock ? 'padding-right:26px;' : '';

        if (isLarge) {
            // Build footer: lecturer left, location right
            const lecturerHtml = lecturer ? `<span style="opacity:0.9; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${lecturer}</span>` : '';
            const locationHtml = location ? `<span style="display:flex; align-items:center; gap:3px; opacity:0.9; flex-shrink:0;">${locationIcon}<span>${location}</span></span>` : '';
            const footerContent = (lecturer || location)
                ? `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">${lecturerHtml}${locationHtml}</div>`
                : '<span style="opacity:0.7;">TBA</span>';

            block.innerHTML = `
                ${lockBtnHtml}
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px; padding-right:26px;">
                    <span style="font-size:11px; font-weight:600; line-height:1.3; flex:1; padding-right:6px;">${courseName}</span>
                    <span style="background:${badgeBg}; color:${badgeFg}; padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; letter-spacing:0.3px; white-space:nowrap;">${badge}</span>
                </div>
                <div style="font-size:14px; font-weight:600; letter-spacing:-0.3px;">
                    ${fmtTime(session.start)} → ${fmtTime(session.end)}
                </div>
                <div style="font-size:9px; margin-top:auto;">
                    ${footerContent}
                </div>
            `;
        } else if (isMedium) {
            // For medium blocks: time row, then location on right if present
            const locationRow = location ? `<div style="display:flex; justify-content:flex-end; align-items:center; gap:2px; font-size:8px; opacity:0.85; margin-top:2px;">${locationIcon}<span>${location}</span></div>` : '';
            block.innerHTML = `
                ${lockBtnHtml}
                <div style="display:flex; justify-content:space-between; align-items:center; padding-right:26px;">
                    <span style="font-size:10px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${courseName}</span>
                    <span style="background:${badgeBg}; color:${badgeFg}; padding:1px 4px; border-radius:2px; font-size:8px; font-weight:600; margin-left:4px;">${badge}</span>
                </div>
                <div style="font-size:12px; font-weight:600; margin-top:2px;">
                    ${fmtTime(session.start)} → ${fmtTime(session.end)}
                </div>
                ${locationRow}
            `;
        } else {
            // Small blocks: compact single row with location on right
            const locationCompact = location ? `<span style="display:inline-flex; align-items:center; gap:1px; margin-left:4px;">${locationIcon}<span>${location}</span></span>` : '';
            block.innerHTML = `
                ${lockBtnHtml}
                <div style="font-size:9px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; padding-right:26px;">${courseName}</div>
                <div style="font-size:8px; opacity:0.85; display:flex; justify-content:space-between; align-items:center;">
                    <span>${fmtTime(session.start)}</span>
                    ${locationCompact}
                </div>
            `;
        }

        // Show lock button always if locked, otherwise on hover
        const lockBtn = block.querySelector('.lock-btn');
        if (lockBtn) {
            if (sessionLocked) {
                lockBtn.style.opacity = '1';
            }

            // Lock button click handler (using addEventListener)
            lockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                if (window.scheduleApp?.toggleLock) {
                    window.scheduleApp.toggleLock(session.course, session.class);
                }
            });
        }

        // Elegant hover using addEventListener (no overwriting)
        block.addEventListener('mouseenter', () => {
            block.style.transform = 'translateY(-1px)';
            block.style.boxShadow = sessionLocked
                ? '0 0 0 2px #FFD700, 0 4px 12px rgba(0,0,0,0.15)'
                : '0 4px 12px rgba(0,0,0,0.15)';
            block.style.zIndex = '5';
            if (lockBtn) lockBtn.style.opacity = '1';
        });
        block.addEventListener('mouseleave', () => {
            block.style.transform = 'translateY(0)';
            block.style.boxShadow = sessionLocked
                ? '0 0 0 2px #FFD700, 0 1px 3px rgba(0,0,0,0.12)'
                : '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)';
            block.style.zIndex = '1';
            if (lockBtn && !sessionLocked) lockBtn.style.opacity = '0';
        });

        // ===================================
        // DRAG-DROP FUNCTIONALITY (only if enabled and not debugging)
        // ===================================
        if (enableDrag && !DEBUG_DISABLE_DRAG) {
            block.draggable = true;
            block.style.cursor = 'grab';

            block.addEventListener('dragstart', (e) => {
                // Store drag data
                const dragData = {
                    course: session.course,
                    class: session.class,
                    sessionType: window.sessionSwapper?.getSessionType?.(session.class) || 'lectures'
                };
                e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                e.dataTransfer.effectAllowed = 'move';

                // Store drag context globally for ghost handlers
                window._dragContext = {
                    course: session.course,
                    className: session.class,
                    container: container,
                    customColors: customColors,
                    active: true
                };

                // Visual feedback
                block.classList.add('dragging');
                block.style.opacity = '0.6';
                block.style.cursor = 'grabbing';

                // HIDE TOOLTIP during drag (Fix 3)
                if (tooltip) tooltip.style.display = 'none';

                // Render ghost drop zones
                if (window.sessionSwapper && window.allSchedules) {
                    const currentSchedule = window.allSchedules[window.viewIndex || 0] || [];
                    const alternatives = window.sessionSwapper.getAlternatives(
                        session.course,
                        dragData.sessionType,
                        session.class,
                        currentSchedule
                    );

                    if (alternatives.length > 0) {
                        window.sessionSwapper.renderGhosts(alternatives, container, customColors);

                        // Manual Drop Handler for Portal Popovers
                        // Since popovers are in document.body, events don't bubble to the ghost naturally.
                        // We dispatched a 'manual-drop' event to the container instead.
                        const manualDropHandler = (evt) => {
                            console.log('[manual-drop] Triggered:', evt.detail);
                            const targetClassName = evt.detail.className;

                            if (window._dragContext && window._dragContext.active) {
                                const ctx = window._dragContext;
                                window._dragContext.active = false;

                                handleSwap(
                                    ctx.course,
                                    ctx.className,
                                    targetClassName,
                                    ctx.container,
                                    ctx.customColors
                                );
                            }
                        };

                        // Attach once, cleanup on dragend
                        container.addEventListener('manual-drop', manualDropHandler, { once: true });

                        // Standard HTML5 DnD: Enable dropping on ghosts
                        container.querySelectorAll('.drop-zone-ghost.valid').forEach(ghost => {
                            // MUST prevent default on dragover to allow dropping
                            ghost.addEventListener('dragover', (evt) => {
                                evt.preventDefault();
                                evt.dataTransfer.dropEffect = 'move';
                                ghost.style.transform = 'scale(1.02)';
                            });
                            ghost.addEventListener('dragleave', () => ghost.style.transform = 'scale(1)');

                            ghost.addEventListener('drop', (evt) => {
                                evt.preventDefault();
                                evt.stopPropagation();

                                // Fix 5: If this ghost has a popover (multiple options), 
                                // don't swap directly - user must select from expanded popover
                                if (ghost.dataset.hasPopover === 'true') {
                                    console.log('[DnD] Drop on multi-option ghost - popover should be showing');
                                    // The popover is already expanded via dragenter/dragover
                                    // User needs to drop on a specific option inside the popover
                                    return; // Don't swap on the primary card
                                }

                                console.log('[DnD] Drop on ghost:', ghost.dataset.className);

                                // Only handle if we're in an active drag
                                if (!window._dragContext?.active) return;

                                const targetClassName = ghost.dataset.className;
                                const ctx = window._dragContext;

                                // Mark drag as complete to prevent double-handling
                                window._dragContext.active = false;

                                // Perform the swap
                                handleSwap(
                                    ctx.course,
                                    ctx.className,
                                    targetClassName,
                                    ctx.container,
                                    ctx.customColors
                                );
                            });
                        });
                    }
                }
            });

            block.addEventListener('dragend', () => {
                // Cleanup
                if (window._dragContext && window._dragContext.manualDropHandler) {
                    container.removeEventListener('manual-drop', window._dragContext.manualDropHandler);
                }

                block.classList.remove('dragging');
                block.style.opacity = '1';
                block.style.cursor = 'grab';

                // Clear ghosts
                if (window.sessionSwapper) {
                    window.sessionSwapper.clearGhosts(container);
                }
                // Clear drag context
                window._dragContext = null;

                // RE-ENABLE TOOLTIP after drag (Fix 3)
                // Tooltip will show again naturally on next mouseenter
            });
        } // End of if (enableDrag)

        dayCol.appendChild(block);

        // Tooltip
        if (enableTooltip && tooltip) {
            block.onmouseenter = (e) => {
                block.style.transform = 'translateY(-1px)';
                block.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                block.style.zIndex = '5';

                tooltip.innerHTML = `
                    <div class="tooltip-header">${courseName}</div>
                    <div class="tooltip-badge" style="background:${badgeBg}">${session.class || ''}</div>
                    <div class="tooltip-details">
                        <div><span class="label">Time</span>${fmtTime(session.start)} – ${fmtTime(session.end)}</div>
                        <div><span class="label">Day</span>${session.day}</div>
                        <div><span class="label">Lecturer</span>${lecturer}</div>
                        <div><span class="label">Location</span>${session.location || 'TBA'}</div>
                    </div>
                `;
                tooltip.style.borderLeftColor = bgColor;

                const pad = 10;
                let left = e.clientX + pad;
                let top = e.clientY + pad;
                tooltip.style.display = 'block';
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';

                const r = tooltip.getBoundingClientRect();
                if (left + r.width > window.innerWidth) tooltip.style.left = (e.clientX - r.width - pad) + 'px';
                if (top + r.height > window.innerHeight) tooltip.style.top = (e.clientY - r.height - pad) + 'px';
            };

            block.onmousemove = (e) => {
                const pad = 10;
                let left = e.clientX + pad;
                let top = e.clientY + pad;
                const r = tooltip.getBoundingClientRect();
                if (left + r.width > window.innerWidth) left = e.clientX - r.width - pad;
                if (top + r.height > window.innerHeight) top = e.clientY - r.height - pad;
                tooltip.style.left = left + 'px';
                tooltip.style.top = top + 'px';
            };

            block.onmouseleave = () => {
                block.style.transform = 'translateY(0)';
                block.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)';
                block.style.zIndex = '1';
                tooltip.style.display = 'none';
            };
        }
    });
}