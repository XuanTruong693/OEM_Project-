import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, Wifi, WifiOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { useLanguage } from '../../context/LanguageContext';

const ServerLogsPanel = ({ fullWidth = false }) => {
    const { t } = useLanguage();
    const [logs, setLogs] = useState([]);
    const [connected, setConnected] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const logsContainerRef = useRef(null);
    const socketRef = useRef(null);

    useEffect(() => {
        // Connect to Socket.IO server
        const socket = io('http://localhost:5000', {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('📡 Connected to server logs');
            setConnected(true);
            // Join logs room
            socket.emit('admin:join-logs');
        });

        socket.on('disconnect', () => {
            console.log('📡 Disconnected from server logs');
            setConnected(false);
        });

        // Receive history logs
        socket.on('server:logs-history', (historyLogs) => {
            setLogs(historyLogs);
        });

        // Receive new log
        socket.on('server:log', (log) => {
            setLogs(prev => {
                const newLogs = [...prev, log];
                // Keep only last 50 logs in UI
                if (newLogs.length > 50) {
                    return newLogs.slice(-50);
                }
                return newLogs;
            });
        });

        return () => {
            socket.emit('admin:leave-logs');
            socket.disconnect();
        };
    }, []);

    // Auto-scroll to bottom when new logs arrive
    useEffect(() => {
        if (autoScroll && logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const clearLogs = () => {
        setLogs([]);
    };

    const getLogColor = (type) => {
        switch (type) {
            case 'error':
                return 'text-red-400';
            case 'warn':
                return 'text-yellow-400';
            default:
                return 'text-green-400';
        }
    };

    const getLogIcon = (type) => {
        switch (type) {
            case 'error':
                return '❌';
            case 'warn':
                return '⚠️';
            default:
                return '✅';
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-green-400" />
                    <span className="text-white text-sm font-medium">Server Logs</span>
                    <span className={`flex items-center gap-1 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
                        {connected ? (
                            <>
                                <Wifi size={12} />
                                <span>Live</span>
                            </>
                        ) : (
                            <>
                                <WifiOff size={12} />
                                <span>Offline</span>
                            </>
                        )}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoScroll}
                            onChange={(e) => setAutoScroll(e.target.checked)}
                            className="w-3 h-3"
                        />
                        Auto-scroll
                    </label>
                    <button
                        onClick={clearLogs}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Clear logs"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* Logs Container */}
            <div
                ref={logsContainerRef}
                className={`${fullWidth ? 'h-96' : 'h-48'} overflow-y-auto bg-black p-3 font-mono text-xs`}
                style={{ scrollBehavior: 'smooth' }}
            >
                {logs.length === 0 ? (
                    <div className="text-gray-500 text-center py-8">
                        {connected ? 'Waiting for logs...' : 'Connecting to server...'}
                    </div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex gap-2 py-0.5 hover:bg-gray-900/50">
                            <span className="text-gray-500 shrink-0">
                                [{formatTime(log.timestamp)}]
                            </span>
                            <span className="shrink-0">
                                {getLogIcon(log.type)}
                            </span>
                            <span className={`${getLogColor(log.type)} break-all`}>
                                {log.message}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ServerLogsPanel;
