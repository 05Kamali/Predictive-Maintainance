/**
 * AI Predictive Maintenance Dashboard - Logic
 */

const API_BASE_URL = '/api';

// --- 1. Live Telemetry Chart ---
const ctx = document.getElementById('telemetryChart').getContext('2d');

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";

const telemetryData = {
    labels: Array.from({length: 20}, (_, i) => `T-${20-i}s`),
    datasets: [
        {
            label: 'Vibration (mm/s)',
            data: Array.from({length: 20}, () => 0),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
        },
        {
            label: 'Temperature (°C)',
            data: Array.from({length: 20}, () => 60),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            tension: 0.4,
            yAxisID: 'y1'
        }
    ]
};

const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: telemetryData,
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: {
            x: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
            y: { title: { display: true, text: 'Vibration' }, min: 0, max: 12 },
            y1: { position: 'right', title: { display: true, text: 'Temperature' }, grid: { drawOnChartArea: false }, min: 40, max: 110 }
        }
    }
});

// Fetch Live Data Feed
setInterval(async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/telemetry`);
        const data = await response.json();
        
        const timeLabel = new Date().toLocaleTimeString([], {hour12: false, second: '2-digit'});
        
        telemetryData.labels.push(timeLabel);
        telemetryData.labels.shift();
        
        telemetryData.datasets[0].data.push(data.vibration);
        telemetryData.datasets[0].data.shift();
        
        telemetryData.datasets[1].data.push(data.temperature);
        telemetryData.datasets[1].data.shift();

        telemetryChart.update('none');

        if(data.is_predicted_failure) {
            document.getElementById("predicted-failures").textContent = "Warning";
            document.getElementById("predicted-failures").classList.add("pulse-text");
            
             if(Math.random() > 0.5) {
                addAlert('critical', 'AI Model: Failure Imminent', `Random Forest Model indicates a ${data.failure_probability}% failure probability based on Vib (${data.vibration}) and Temp (${data.temperature}).`);
             }
        } else {
            document.getElementById("predicted-failures").textContent = "0";
            document.getElementById("predicted-failures").classList.remove("pulse-text");
        }
        
    } catch (error) {
        console.error("Backend unreachable.", error);
    }
}, 2000);


// --- 2. Alerts Engine ---
const alertList = document.getElementById('alert-list');

function addAlert(type, title, message) {
    let iconClass = type === 'critical' ? 'fa-triangle-exclamation' : (type === 'warning' ? 'fa-bolt' : 'fa-info-circle');
    
    const alertItem = document.createElement('div');
    alertItem.className = `alert-item ${type}`;
    const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    alertItem.innerHTML = `
        <i class="fa-solid ${iconClass} alert-icon"></i>
        <div class="alert-content">
            <h4>${title}</h4>
            <p>${message}</p>
            <span class="alert-time">${time} - AI Prediction Engine</span>
        </div>
    `;

    alertList.prepend(alertItem);
    if (alertList.children.length > 10) alertList.removeChild(alertList.lastChild);
    
    document.getElementById('nav-alert-badge').textContent = document.querySelectorAll('.alert-item.warning').length + document.querySelectorAll('.alert-item.critical').length;
}


// --- 3. Equipment Engine ---
const tbody = document.getElementById('equipment-tbody');

async function renderEquipment() {
    try {
        const response = await fetch(`${API_BASE_URL}/equipment`);
        const equipmentData = await response.json();
        
        tbody.innerHTML = '';
        let criticals = 0;

        equipmentData.forEach(eq => {
            const tr = document.createElement('tr');
            let statusClass = eq.status === 'Warning' ? 'warning' : (eq.status === 'Critical' ? 'critical' : 'healthy');
            if(eq.status === 'Critical') criticals++;

            tr.innerHTML = `
                <td><strong>${eq.id}</strong></td>
                <td>${eq.type}</td>
                <td><span class="status-badge ${statusClass}">${eq.status}</span></td>
                <td>${eq.temp}</td>
                <td>${eq.rul}</td>
                <td>${eq.confidence} <i class="fa-solid fa-robot" style="margin-left: 4px; color: var(--accent-blue); opacity: 0.7;"></i></td>
            `;
            tbody.appendChild(tr);
        });

        // Update KPI
        const critDOM = document.getElementById('critical-anomalies');
        critDOM.textContent = criticals;
        if(criticals > 0) {
            critDOM.classList.add("pulse-text");
            critDOM.nextElementSibling.textContent = "Requires Immediate Attention!";
        } else {
            critDOM.classList.remove("pulse-text");
            critDOM.nextElementSibling.textContent = "System Normal";
        }

    } catch (error) {}
}

renderEquipment();
setInterval(renderEquipment, 2000); // Dynamic living engine polling

setInterval(() => {
    document.getElementById('oee-value').textContent = `${(84.5 + (Math.random() * 2 - 1)).toFixed(1)}%`;
    document.getElementById('overall-health').textContent = `${(98 + (Math.random() * 2 - 1)).toFixed(1)}%`;
}, 5000);


// --- 4. Sidebar View Switching ---
document.querySelectorAll('#sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('#sidebar-nav .nav-item').forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const viewName = e.currentTarget.getAttribute('data-view');
        
        // Hide all
        document.querySelectorAll('.app-view').forEach(view => {
            view.style.display = 'none';
        });
        
        // Show matched view
        const targetView = document.getElementById(`view-${viewName}`);
        if(targetView) {
            targetView.style.display = 'block';
        } else {
            // Default fallback
            document.getElementById('view-dashboard').style.display = 'block';
            addAlert('info', 'Module Locked', `The ${viewName} interface is currently under construction.`);
        }
    });
});

// --- 5. Settings Logic ---
const slider = document.getElementById('anomaly-slider');
const sliderVal = document.getElementById('anomaly-val');

if(slider) {
    slider.addEventListener('input', (e) => {
        sliderVal.textContent = `${e.target.value}%`;
    });
    
    document.getElementById('btn-save-settings').addEventListener('click', async () => {
        const rate = parseInt(slider.value) / 100.0;
        try {
            await fetch(`${API_BASE_URL}/settings`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({anomaly_rate: rate})
            });
            addAlert('info', 'Settings Updated', `System anomaly injection rate adjusted to ${slider.value}%`);
            
            // Go back to dashboard to watch the chaos!
            document.querySelector('[data-view="dashboard"]').click();
        } catch(e) {
            console.error(e);
        }
    });
}
