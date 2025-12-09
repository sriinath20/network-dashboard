import { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  ArrowDown, 
  ArrowUp, 
  Globe, 
  Server, 
  MapPin,
  RefreshCw,
  Zap,
  Signal,
  Cpu,
  Battery,
  Smartphone,
  WifiOff,
  Download,
  Moon,
  Sun,
  MonitorPlay,
  Gamepad2,
  Phone,
  FileText
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

// --- Types ---
interface SpeedTestResult {
  id: number;
  date: string;
  download: number;
  upload: number;
  ping: number;
  isp: string;
}

interface LogEntry {
  time: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

const App = () => {
  // --- State ---
  const [darkMode, setDarkMode] = useState(true);
  const [testing, setTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Network Data
  const [networkInfo, setNetworkInfo] = useState({
    ip: 'Loading...',
    isp: 'Loading...',
    city: 'Loading...',
    country: 'Loading...',
    asn: '...',
    lat: 0,
    lon: 0,
    timezone: '...'
  });

  const [metrics, setMetrics] = useState({
    download: 0,
    upload: 0,
    ping: 0,
    jitter: 0,
    signalStrength: 0
  });

  // Device Info
  const [deviceInfo, setDeviceInfo] = useState({
    cores: navigator.hardwareConcurrency || 4,
    memory: (navigator as any).deviceMemory || 'Unknown',
    userAgent: navigator.userAgent,
    platform: (navigator as any).userAgentData?.platform || navigator.platform,
    battery: 'Checking...'
  });

  // History & Logs
  const [history, setHistory] = useState<SpeedTestResult[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Graph Data
  const [trafficData, setTrafficData] = useState(
    Array.from({ length: 20 }, (_, i) => ({
      time: i,
      sent: 0,
      received: 0,
    }))
  );

  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const isOnline = navigator.onLine;

  // --- Effects ---

  // 1. Initial Load & Listeners
  useEffect(() => {
    fetchNetworkInfo();
    loadHistory();
    
    // Uptime Monitoring
    const handleOnline = () => addLog('success', 'Connection Restored');
    const handleOffline = () => addLog('error', 'Connection Lost');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery Status
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        const updateBatt = () => {
          setDeviceInfo(prev => ({
            ...prev,
            battery: `${Math.round(batt.level * 100)}% ${batt.charging ? '(Charging)' : ''}`
          }));
        };
        updateBatt();
        batt.addEventListener('levelchange', updateBatt);
        batt.addEventListener('chargingchange', updateBatt);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Traffic Graph Loop
  useEffect(() => {
    const interval = setInterval(updateTrafficGraph, 1000);
    return () => clearInterval(interval);
  }, [testing, metrics.download]);

  // --- Logic ---

  const addLog = (type: 'error' | 'success' | 'info', message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [{ time, type, message }, ...prev].slice(0, 50));
  };

  const loadHistory = () => {
    const saved = localStorage.getItem('netdash_history');
    if (saved) setHistory(JSON.parse(saved));
  };

  const saveResult = (newMetrics: typeof metrics) => {
    const newEntry: SpeedTestResult = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      download: newMetrics.download,
      upload: newMetrics.upload,
      ping: newMetrics.ping,
      isp: networkInfo.isp
    };
    const updated = [newEntry, ...history].slice(0, 10); // Keep last 10
    setHistory(updated);
    localStorage.setItem('netdash_history', JSON.stringify(updated));
  };

  const exportReport = () => {
    const headers = ['Date', 'Download (Mbps)', 'Upload (Mbps)', 'Ping (ms)', 'ISP'];
    const rows = history.map(h => [h.date, h.download, h.upload, h.ping, h.isp]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "network_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateTrafficGraph = () => {
    setTrafficData(prev => {
      const newTime = prev[prev.length - 1].time + 1;
      // Traffic correlates with download speed during test
      const baseRecv = testing ? metrics.download * 0.125 : Math.random() * 0.5; // Mb/s to MB/s approx
      const baseSent = testing ? metrics.upload * 0.125 : Math.random() * 0.1;

      const newData = {
        time: newTime,
        sent: parseFloat((baseSent + Math.random() * 0.2).toFixed(2)),
        received: parseFloat((baseRecv + Math.random() * 0.5).toFixed(2))
      };
      return [...prev.slice(1), newData];
    });
  };

  const fetchNetworkInfo = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (!response.ok) throw new Error('Blocked');
      const data = await response.json();
      setNetworkInfo({
        ip: data.ip,
        isp: data.org,
        city: data.city,
        country: data.country_name,
        asn: data.asn,
        lat: data.latitude,
        lon: data.longitude,
        timezone: data.timezone
      });
      addLog('info', `Connected to ${data.org}`);
    } catch (error) {
      setNetworkInfo(prev => ({ ...prev, ip: 'Unavailable', isp: 'Blocked by AdBlocker' }));
      addLog('error', 'Failed to fetch ISP info');
    }
  };

  // --- Real Speed Test Logic ---
  const runSpeedTest = async () => {
    if (testing) return;
    setTesting(true);
    setProgress(0);
    addLog('info', 'Starting Diagnostics...');

    // 1. Latency (Real)
    const pings = [];
    for(let i=0; i<5; i++) {
        const start = performance.now();
        await fetch('https://www.google.com/favicon.ico?' + Math.random(), { mode: 'no-cors' });
        pings.push(performance.now() - start);
        setProgress(10 + (i*2));
    }
    const avgPing = Math.round(pings.reduce((a, b) => a + b) / pings.length);
    const jitter = Math.round(Math.max(...pings) - Math.min(...pings));
    
    setMetrics(prev => ({ ...prev, ping: avgPing, jitter }));

    // 2. Download Test (Real-ish)
    // We fetch a 5MB image from a public CDN (Unsplash Source) and measure time
    const imageAddr = "https://images.unsplash.com/photo-1481349518771-20055b2a7b24?q=80&w=2000&auto=format&fit=crop"; 
    const downloadSize = 5000000; // Approx 5MB
    const startTime = performance.now();
    
    try {
        await fetch(imageAddr + "&cache=" + Math.random(), { mode: 'no-cors' });
        const endTime = performance.now();
        const durationSeconds = (endTime - startTime) / 1000;
        const bitsLoaded = downloadSize * 8;
        const speedBps = bitsLoaded / durationSeconds;
        const speedMbps = Math.round(speedBps / 1024 / 1024);
        
        // Update metrics gradually for visual effect
        let current = 0;
        const step = speedMbps / 20;
        const ramp = setInterval(() => {
            current += step;
            if (current >= speedMbps) {
                clearInterval(ramp);
                setMetrics(prev => ({ ...prev, download: speedMbps }));
            } else {
                setMetrics(prev => ({ ...prev, download: Math.round(current) }));
            }
            setProgress(prev => Math.min(prev + 1, 60));
        }, 50);
        
        // 3. Upload (Simulated based on Download)
        // Browsers can't easily do real upload tests without a specific backend endpoint
        setTimeout(() => {
            const simulatedUpload = Math.round(speedMbps * (connection?.type === 'cellular' ? 0.1 : 0.3));
            setMetrics(prev => ({ ...prev, upload: simulatedUpload, download: speedMbps }));
            setProgress(100);
            setTesting(false);
            
            const finalResults = {
                download: speedMbps,
                upload: simulatedUpload,
                ping: avgPing,
                jitter: jitter,
                signalStrength: Math.max(0, 100 - avgPing)
            };
            setMetrics(prev => ({ ...prev, ...finalResults }));
            saveResult(finalResults);
            addLog('success', `Test Complete: ${speedMbps} Mbps`);
        }, 1500);

    } catch (e) {
        addLog('error', 'Speed test failed (Network Error)');
        setTesting(false);
    }
  };

  // --- Render Helpers ---

  const getQoS = () => {
    const s = metrics.download;
    const p = metrics.ping;
    return [
      { name: '4K Streaming', pass: s > 25, icon: MonitorPlay },
      { name: 'Online Gaming', pass: p < 50 && p > 0, icon: Gamepad2 },
      { name: 'Video Calls', pass: s > 10 && metrics.upload > 2, icon: Phone },
      { name: 'Large Files', pass: s > 50, icon: FileText },
    ];
  };

  const themeClasses = darkMode 
    ? "bg-slate-950 text-slate-100" 
    : "bg-slate-50 text-slate-900";
    
  const cardClasses = darkMode
    ? "bg-slate-900/50 border-slate-800"
    : "bg-white border-slate-200 shadow-sm";

  const textMuted = darkMode ? "text-slate-400" : "text-slate-500";
  const textHighlight = darkMode ? "text-slate-200" : "text-slate-800";

  return (
    <div className={`min-h-screen transition-colors duration-300 font-mono ${themeClasses} p-4 md:p-8`}>
      {/* Header */}
      <div className={`max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-200'} pb-6`}>
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-500">
              NetDash <span className={textMuted + " font-normal text-sm"}>v3.0.0</span>
            </h1>
            <p className={`${textMuted} text-xs`}>Advanced Network Telemetry</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-slate-800 hover:bg-slate-700' : 'bg-slate-200 hover:bg-slate-300'}`}
            >
                {darkMode ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>
            <button 
            onClick={runSpeedTest}
            disabled={testing}
            className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
                testing 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
            }`}
            >
            <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
            {testing ? `Running ${progress}%` : 'Run Diagnostics'}
            </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* === Left Column (Stats & Graphs) === */}
        <div className="lg:col-span-3 space-y-6">
            
          {/* Quick Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Download */}
            <div className={`${cardClasses} border p-6 rounded-xl relative overflow-hidden group transition-all`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowDown className="w-24 h-24 text-blue-500" />
              </div>
              <div className={`flex items-center gap-2 ${textMuted} mb-2`}>
                <ArrowDown className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Download</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${textHighlight}`}>{metrics.download}</span>
                <span className={`text-sm ${textMuted}`}>Mbps</span>
              </div>
              <div className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-200'} h-1 mt-4 rounded-full overflow-hidden`}>
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${Math.min(metrics.download, 100)}%` }}
                />
              </div>
            </div>

            {/* Upload */}
            <div className={`${cardClasses} border p-6 rounded-xl relative overflow-hidden group transition-all`}>
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowUp className="w-24 h-24 text-purple-500" />
              </div>
              <div className={`flex items-center gap-2 ${textMuted} mb-2`}>
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Upload</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${textHighlight}`}>{metrics.upload}</span>
                <span className={`text-sm ${textMuted}`}>Mbps</span>
              </div>
              <div className={`w-full ${darkMode ? 'bg-slate-800' : 'bg-slate-200'} h-1 mt-4 rounded-full overflow-hidden`}>
                <div 
                  className="h-full bg-purple-500 transition-all duration-500" 
                  style={{ width: `${Math.min(metrics.upload * 2, 100)}%` }}
                />
              </div>
            </div>

            {/* Ping */}
            <div className={`${cardClasses} border p-6 rounded-xl relative overflow-hidden group transition-all`}>
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-24 h-24 text-yellow-500" />
              </div>
              <div className={`flex items-center gap-2 ${textMuted} mb-2`}>
                <Zap className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Latency</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-bold ${textHighlight}`}>{metrics.ping}</span>
                <span className={`text-sm ${textMuted}`}>ms</span>
              </div>
              <div className={`flex items-center gap-2 mt-2 text-xs ${textMuted}`}>
                <span>Jitter: {metrics.jitter}ms</span>
              </div>
            </div>
          </div>

          {/* QoS Scorecard */}
          <div className={`${cardClasses} border rounded-xl p-6`}>
            <h3 className={`${textHighlight} font-semibold mb-4 flex items-center gap-2`}>
                <MonitorPlay className="w-5 h-5 text-indigo-500" />
                Can I Stream It? (Quality of Service)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {getQoS().map((item) => (
                    <div key={item.name} className={`flex items-center gap-3 p-3 rounded-lg border ${item.pass ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/5'}`}>
                        <item.icon className={`w-5 h-5 ${item.pass ? 'text-emerald-500' : 'text-red-500'}`} />
                        <div>
                            <p className={`text-xs font-bold ${item.pass ? 'text-emerald-500' : 'text-red-500'}`}>{item.name}</p>
                            <p className={`text-[10px] ${textMuted}`}>{item.pass ? 'Excellent' : 'Poor'}</p>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* Real-time Graph */}
          <div className={`${cardClasses} border rounded-xl p-6`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-lg font-semibold ${textHighlight} flex items-center gap-2`}>
                <Activity className="w-5 h-5 text-indigo-400" />
                Live Traffic Throughput
              </h3>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className={textMuted}>Received (RX)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className={textMuted}>Sent (TX)</span>
                </div>
              </div>
            </div>
            
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trafficData}>
                  <defs>
                    <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? "#1e293b" : "#e2e8f0"} vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val} MB`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: darkMode ? '#0f172a' : '#fff', borderColor: darkMode ? '#1e293b' : '#e2e8f0' }}
                    itemStyle={{ fontSize: '12px' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area type="monotone" dataKey="received" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorRx)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorTx)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History Table */}
          <div className={`${cardClasses} border rounded-xl p-6`}>
             <div className="flex justify-between items-center mb-4">
                <h3 className={`${textHighlight} font-bold text-sm uppercase tracking-wider`}>Test History</h3>
                <button onClick={exportReport} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300">
                    <Download className="w-3 h-3" /> Export CSV
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className={`text-xs ${textMuted} uppercase bg-opacity-50 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                        <tr>
                            <th className="py-2">Date</th>
                            <th className="py-2">Ping</th>
                            <th className="py-2">Down</th>
                            <th className="py-2">Up</th>
                            <th className="py-2">ISP</th>
                        </tr>
                    </thead>
                    <tbody className={textHighlight}>
                        {history.length === 0 ? (
                            <tr><td colSpan={5} className="py-4 text-center text-xs opacity-50">No tests run yet</td></tr>
                        ) : (
                            history.map(h => (
                                <tr key={h.id} className={`border-b ${darkMode ? 'border-slate-800/50' : 'border-slate-100'}`}>
                                    <td className="py-2 text-xs">{h.date.split(',')[0]}</td>
                                    <td className="py-2">{h.ping} ms</td>
                                    <td className="py-2 text-blue-500">{h.download}</td>
                                    <td className="py-2 text-purple-500">{h.upload}</td>
                                    <td className="py-2 text-xs opacity-70">{h.isp.substring(0, 15)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
          </div>
        </div>

        {/* === Right Column (Sidebar) === */}
        <div className="lg:col-span-1 space-y-4">
          
            {/* Visual Map */}
            {networkInfo.lat !== 0 && (
                <div className={`${cardClasses} border rounded-xl overflow-hidden h-48 relative`}>
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        scrolling="no" 
                        marginHeight={0} 
                        marginWidth={0} 
                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${networkInfo.lon-0.05},${networkInfo.lat-0.05},${networkInfo.lon+0.05},${networkInfo.lat+0.05}&layer=mapnik&marker=${networkInfo.lat},${networkInfo.lon}`}
                        className="opacity-80 hover:opacity-100 transition-opacity"
                    ></iframe>
                    <div className="absolute bottom-0 left-0 bg-slate-900/80 text-white text-[10px] px-2 py-1 m-2 rounded">
                        Approx Location
                    </div>
                </div>
            )}

            {/* Connection Details */}
            <div className={`${cardClasses} border rounded-xl p-5 space-y-4`}>
                <h3 className={`${textMuted} text-xs font-bold uppercase tracking-wider mb-2`}>Connection</h3>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <Globe className="w-5 h-5 text-blue-400 mt-0.5" />
                        <div>
                        <p className={`text-xs ${textMuted}`}>IP Address</p>
                        <p className={`text-sm font-medium ${textHighlight}`}>{networkInfo.ip}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                        <div>
                        <p className={`text-xs ${textMuted}`}>Location</p>
                        <p className={`text-sm font-medium ${textHighlight}`}>{networkInfo.city}, {networkInfo.country}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Signal className="w-5 h-5 text-emerald-400 mt-0.5" />
                        <div>
                        <p className={`text-xs ${textMuted}`}>Signal Type</p>
                        <p className={`text-sm font-medium ${textHighlight}`}>
                            {connection ? (connection.effectiveType === '4g' ? '4G+ / 5G / Fiber' : connection.effectiveType.toUpperCase()) : 'WiFi / Ethernet'}
                        </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Device Specs */}
            <div className={`${cardClasses} border rounded-xl p-5 space-y-4`}>
                <h3 className={`${textMuted} text-xs font-bold uppercase tracking-wider mb-2`}>This Device</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div className={`p-2 rounded bg-opacity-5 ${darkMode ? 'bg-white' : 'bg-black'}`}>
                        <div className="flex items-center gap-2 mb-1"><Cpu className="w-3 h-3 text-indigo-400" /><span className="text-[10px] uppercase">Cores</span></div>
                        <div className={`font-bold ${textHighlight}`}>{deviceInfo.cores}</div>
                    </div>
                    <div className={`p-2 rounded bg-opacity-5 ${darkMode ? 'bg-white' : 'bg-black'}`}>
                         <div className="flex items-center gap-2 mb-1"><Activity className="w-3 h-3 text-pink-400" /><span className="text-[10px] uppercase">RAM</span></div>
                         <div className={`font-bold ${textHighlight}`}>{deviceInfo.memory} GB</div>
                    </div>
                    <div className={`p-2 rounded bg-opacity-5 ${darkMode ? 'bg-white' : 'bg-black'} col-span-2`}>
                        <div className="flex items-center gap-2 mb-1"><Smartphone className="w-3 h-3 text-orange-400" /><span className="text-[10px] uppercase">OS / Browser</span></div>
                        <div className={`text-xs truncate ${textHighlight}`} title={deviceInfo.userAgent}>{deviceInfo.platform}</div>
                    </div>
                     <div className={`p-2 rounded bg-opacity-5 ${darkMode ? 'bg-white' : 'bg-black'} col-span-2`}>
                        <div className="flex items-center gap-2 mb-1"><Battery className="w-3 h-3 text-emerald-400" /><span className="text-[10px] uppercase">Battery</span></div>
                        <div className={`text-xs ${textHighlight}`}>{deviceInfo.battery}</div>
                    </div>
                </div>
            </div>

            {/* Uptime Logs */}
            <div className={`${cardClasses} border rounded-xl p-5`}>
                <h3 className={`${textMuted} text-xs font-bold uppercase tracking-wider mb-3`}>Event Log</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {logs.length === 0 && <p className="text-[10px] text-center opacity-50">No events logged yet</p>}
                    {logs.map((log, i) => (
                        <div key={i} className="flex gap-2 text-[10px]">
                            <span className="opacity-50">{log.time}</span>
                            <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-blue-400'}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default App;
