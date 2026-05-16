/*const axios = require('axios');

let cachedData = null;
let lastFetchTime = null;
const CACHE_DURATION = 60 * 60 * 1000;

async function getNequiStatus(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && cachedData && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
        return { ...cachedData, fromCache: true };
    }
    
    try {
        const statusApi = await axios.get('https://status.nequi.com.co/api/v2/status.json', {
            timeout: 10000
        });
        
        const componentsApi = await axios.get('https://status.nequi.com.co/api/v2/components.json', {
            timeout: 10000
        });
        
        const components = componentsApi.data.components;
        const generalStatus = statusApi.data.status.description;
        const indicator = statusApi.data.status.indicator;
        const mainComponents = components.filter(comp => comp.group === false);
        const groupsMap = new Map();
        
        mainComponents.forEach(comp => {
            const serviceData = {
                name: comp.name,
                status: translateStatus(comp.status),
                statusClass: getStatusClass(comp.status),
                updatedAt: comp.updated_at
            };
            
            if (comp.group_id) {
                const parentGroup = components.find(g => g.id === comp.group_id);
                const groupName = parentGroup ? parentGroup.name : 'Otros';
                
                if (!groupsMap.has(comp.group_id)) {
                    groupsMap.set(comp.group_id, {
                        id: comp.group_id,
                        name: groupName,
                        children: [],
                        status: 'operational',
                        statusClass: 'operational'
                    });
                }
                groupsMap.get(comp.group_id).children.push(serviceData);
            } else {
                if (!groupsMap.has('individual')) {
                    groupsMap.set('individual', {
                        name: 'Servicios Individuales',
                        isIndividual: true,
                        children: []
                    });
                }
                groupsMap.get('individual').children.push(serviceData);
            }
        });
        
        const groups = [];
        let individualServices = [];
        
        for (const [key, group] of groupsMap) {
            if (key === 'individual') {
                individualServices = group.children;
            } else {
                const hasOutage = group.children.some(c => c.statusClass === 'outage');
                const hasPartial = group.children.some(c => c.statusClass === 'partial');
                const hasDegraded = group.children.some(c => c.statusClass === 'degraded');
                
                let groupStatus = 'operational';
                let groupStatusClass = 'operational';
                let groupStatusText = 'Operacional';
                
                if (hasOutage) {
                    groupStatus = 'major_outage';
                    groupStatusClass = 'outage';
                    groupStatusText = 'Interrupción mayor';
                } else if (hasPartial) {
                    groupStatus = 'partial_outage';
                    groupStatusClass = 'partial';
                    groupStatusText = 'Interrupción parcial';
                } else if (hasDegraded) {
                    groupStatus = 'degraded_performance';
                    groupStatusClass = 'degraded';
                    groupStatusText = 'Rendimiento degradado';
                }
                
                groups.push({
                    name: group.name,
                    status: groupStatusText,
                    statusClass: groupStatusClass,
                    children: group.children
                });
            }
        }
        
        const groupOrder = ['Envía', 'Retiros', 'Recargas'];
        groups.sort((a, b) => {
            const indexA = groupOrder.indexOf(a.name);
            const indexB = groupOrder.indexOf(b.name);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
        });
        
        const result = {
            success: true,
            lastUpdate: new Date().toISOString(),
            lastUpdateTimestamp: now,
            generalStatus: generalStatus,
            indicator: indicator,
            isAllOperational: indicator === 'none',
            groups: groups,
            individualServices: individualServices,
            fromCache: false
        };
        
        cachedData = result;
        lastFetchTime = now;
        
        return result;
        
    } catch (error) {
        console.error('Error obteniendo estado de Nequi:', error.message);
        
        if (cachedData) {
            return { 
                ...cachedData, 
                fromCache: true, 
                cacheExpired: true,
                warning: 'Datos con posible retraso'
            };
        }
        
        return {
            success: false,
            error: error.message,
            lastUpdate: new Date().toISOString(),
            generalStatus: 'Error al obtener datos',
            isAllOperational: false,
            groups: [],
            individualServices: [],
            fromCache: false
        };
    }
}

function translateStatus(status) {
    const statusMap = {
        'operational': 'Operacional',
        'degraded_performance': 'Rendimiento degradado',
        'partial_outage': 'Interrupción parcial',
        'major_outage': 'Interrupción mayor',
        'under_maintenance': 'En mantenimiento'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const statusClassMap = {
        'operational': 'operational',
        'degraded_performance': 'degraded',
        'partial_outage': 'partial',
        'major_outage': 'outage',
        'under_maintenance': 'maintenance'
    };
    return statusClassMap[status] || 'unknown';
}

function clearCache() {
    cachedData = null;
    lastFetchTime = null;
}

module.exports = { getNequiStatus, clearCache };
*/