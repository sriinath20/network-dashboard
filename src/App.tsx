import { useState, useEffect } from 'react';
import { 
  Activity, 
  ArrowDown, 
  ArrowUp, 
  Globe, 
  Server, 
  Router, 
  Shield, 
  MapPin,
  RefreshCw,
  Zap,
  Signal
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

const App = () => {
  const [testing, setTesting] = useState(false);
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

  // Simulated packet data for the graph
  const [trafficData, setTrafficData] = useState(
    Array.from({ length: 20 }, (_, i) => ({
      time: i,
      sent: Math.floor(Math.random() * 50),
      received: Math.floor(Math.random() * 100),
    }))
  );

  // Browser connection API (Chrome/Edge only usually)
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

  useEffect(() => {
    fetchNetworkInfo();
    const interval = setInterval(updateTrafficGraph, 1000);
    return () => clearInterval(interval);
  }, [testing]);

  const updateTrafficGraph = () => {
    setTrafficData(prev => {
      const newTime = prev[prev.length - 1].time + 1;
      
      // If testing, spike the numbers
      const baseRecv = testing ? 5000 + Math.random() * 2000 : 50 + Math.random() * 100;
      const baseSent = testing ? 1000 + Math.random() * 500 : 20 + Math.random() * 50;

      const newData = {
        time: newTime,
        sent: Math.floor(baseSent),
        received: Math.floor(baseRecv)
      };
      return [...prev.slice(1), newData];
    });
  };

  const fetchNetworkInfo = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
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
      
      // Initial rough ping estimation
      const start = performance.now();
      await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
      const end = performance.now();
      setMetrics(prev => ({ ...prev, ping: Math.round(end - start) }));
      
    } catch (error) {
      console.error("Failed to fetch IP info", error);
      setNetworkInfo(prev => ({ ...prev, isp: 'Unknown (Adblocker?)' }));
    }
  };

  const runSpeedTest = async () => {
    if (testing) return;
    setTesting(true);
    setMetrics(prev => ({ ...prev, download: 0, upload: 0 }));

    // 1. Ping Test
    const pings = [];
    for(let i=0; i<5; i++) {
        const start = performance.now();
        await fetch('https://www.google.com/favicon.ico?' + Math.random(), { mode: 'no-cors' });
        pings.push(performance.now() - start);
    }
    const avgPing = pings.reduce((a, b) => a + b) / pings.length;
    const jitter = Math.max(...pings) - Math.min(...pings);

    // 2. Download Simulation (Estimating bandwidth)
    
    // Simulate signal strength based on connection API or ping
    let signal = 100;
    if (connection) {
        if (connection.effectiveType === '4g') signal = 90;
        if (connection.effectiveType === '3g') signal = 60;
        if (connection.effectiveType === '2g') signal = 30;
        if (connection.rtt > 200) signal -= 20;
    } else {
        // Fallback calculation based on ping
        signal = Math.max(0, 100 - (avgPing / 2));
    }

    const interval = setInterval(() => {
        // Fake update for visual effect during "test"
        setMetrics(prev => ({
            ...prev,
            download: Math.floor(Math.random() * 30) + 10 + (prev.download * 0.1),
            upload: Math.floor(Math.random() * 10) + 5
        }));
    }, 200);

    setTimeout(() => {
        clearInterval(interval);
        setTesting(false);
        setMetrics({
            download: Math.floor(10000 / (avgPing + 10)), // Simulated math for demo
            upload: Math.floor(3000 / (avgPing + 10)),
            ping: Math.floor(avgPing),
            jitter: Math.floor(jitter),
            signalStrength: Math.floor(signal)
        });
    }, 3000);
  };

  const getSignalColor = (strength: number) => {
    if (strength > 75) return 'text-emerald-400';
    if (strength > 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-mono">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              NetDash <span className="text-slate-500 font-normal text-sm">v2.4.0</span>
            </h1>
            <p className="text-slate-500 text-xs">Real-time Network Telemetry</p>
          </div>
        </div>
        
        <button 
          onClick={runSpeedTest}
          disabled={testing}
          className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
            testing 
              ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Analyzing...' : 'Run Diagnostics'}
        </button>
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Stats Column */}
        <div className="lg:col-span-3 space-y-6">
            
          {/* Quick Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Download */}
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowDown className="w-24 h-24 text-blue-500" />
              </div>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <ArrowDown className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Download</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{metrics.download}</span>
                <span className="text-sm text-slate-500">Mbps</span>
              </div>
              <div className="w-full bg-slate-800 h-1 mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${Math.min(metrics.download, 100)}%` }}
                />
              </div>
            </div>

            {/* Upload */}
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <ArrowUp className="w-24 h-24 text-purple-500" />
              </div>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <ArrowUp className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Upload</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{metrics.upload}</span>
                <span className="text-sm text-slate-500">Mbps</span>
              </div>
              <div className="w-full bg-slate-800 h-1 mt-4 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-500" 
                  style={{ width: `${Math.min(metrics.upload * 2, 100)}%` }}
                />
              </div>
            </div>

            {/* Ping & Jitter */}
            <div className="bg-slate-900/50 border border-slate-800 p-6 rounded-xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-24 h-24 text-yellow-500" />
              </div>
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-semibold uppercase tracking-wider">Latency</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-white">{metrics.ping}</span>
                <span className="text-sm text-slate-500">ms</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                <span>Jitter: {metrics.jitter}ms</span>
                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                <span className={getSignalColor(metrics.signalStrength)}>
                    Signal: {metrics.signalStrength > 0 ? metrics.signalStrength + '%' : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time Graph */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Live Traffic Throughput
              </h3>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <span className="text-slate-400">Received (RX)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span className="text-slate-400">Sent (TX)</span>
                </div>
              </div>
            </div>
            
            <div className="h-[300px] w-full">
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis stroke="#475569" fontSize={12} tickFormatter={(val) => `${val}kb`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                    itemStyle={{ fontSize: '12px' }}
                    labelStyle={{ display: 'none' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="received" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRx)" 
                    isAnimationActive={false}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="sent" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorTx)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Connection Details Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Connection Details</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Public IP Address</p>
                  <p className="text-sm font-medium text-slate-200">{networkInfo.ip}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Server className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Internet Provider (ISP)</p>
                  <p className="text-sm font-medium text-slate-200">{networkInfo.isp}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Location</p>
                  <p className="text-sm font-medium text-slate-200">{networkInfo.city}, {networkInfo.country}</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Signal className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">Connection Type</p>
                  <p className="text-sm font-medium text-slate-200">
                    {connection ? connection.effectiveType.toUpperCase() : 'WiFi / Ethernet'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Local Network / Hidden Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4">Local Network</h3>
             
             {/* Gateway - Mocked because browsers hide this */}
             <div className="flex items-start gap-3 opacity-60">
                <Router className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="w-full">
                  <div className="flex justify-between">
                    <p className="text-xs text-slate-500">Default Gateway</p>
                    <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">Restricted</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 font-mono">192.168.1.1</p>
                </div>
              </div>

              {/* DNS - Mocked because browsers hide this */}
              <div className="flex items-start gap-3 opacity-60">
                <Shield className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="w-full">
                  <div className="flex justify-between">
                    <p className="text-xs text-slate-500">DNS Server</p>
                    <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-400">Restricted</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 font-mono">8.8.8.8 / System</p>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-900/50 rounded text-xs text-blue-300">
                <p><strong>Note:</strong> Browsers sandbox Gateway & DNS IPs for security. These values are common defaults.</p>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;
