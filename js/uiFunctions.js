// Professional Schedule Calendar Rendering
// Following industry best practices for calendar UI/UX

export function renderSchedule(schedule, containerId, customColors = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(schedule)) return;

    // Clear previous blocks
    container.querySelectorAll('.class-block').forEach(b => b.remove());

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
        const lecturer = session.lecturer || 'TBA';

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

        // Content based on block size
        const isLarge = height >= 85;
        const isMedium = height >= 55;

        if (isLarge) {
            block.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:auto;">
                    <span style="font-size:11px; font-weight:600; line-height:1.3; flex:1; padding-right:6px;">${courseName}</span>
                    <span style="background:${badgeBg}; color:${badgeFg}; padding:2px 6px; border-radius:3px; font-size:9px; font-weight:600; letter-spacing:0.3px; white-space:nowrap;">${badge}</span>
                </div>
                <div style="font-size:13px; font-weight:500; letter-spacing:-0.2px; margin:4px 0;">
                    ${fmtTime(session.start)} → ${fmtTime(session.end)}
                </div>
                <div style="font-size:9px; opacity:0.9; margin-top:auto;">
                    ${lecturer}
                </div>
            `;
        } else if (isMedium) {
            block.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:10px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">${courseName}</span>
                    <span style="background:${badgeBg}; color:${badgeFg}; padding:1px 4px; border-radius:2px; font-size:8px; font-weight:600; margin-left:4px;">${badge}</span>
                </div>
                <div style="font-size:11px; font-weight:500; margin-top:4px;">
                    ${fmtTime(session.start)} → ${fmtTime(session.end)}
                </div>
            `;
        } else {
            block.innerHTML = `
                <div style="font-size:9px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${courseName}</div>
                <div style="font-size:8px; opacity:0.85;">${fmtTime(session.start)}</div>
            `;
        }

        // Elegant hover
        block.onmouseenter = () => {
            block.style.transform = 'translateY(-1px)';
            block.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            block.style.zIndex = '5';
        };
        block.onmouseleave = () => {
            block.style.transform = 'translateY(0)';
            block.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)';
            block.style.zIndex = '1';
        };

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