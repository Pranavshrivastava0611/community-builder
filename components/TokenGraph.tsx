"use client";

import { useEffect, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';

interface PricePoint {
    price: number;
    time: number;
}

interface TokenGraphProps {
    communityId: string;
    tokenSymbol: string;
}

export default function TokenGraph({ communityId, tokenSymbol }: TokenGraphProps) {
    const [data, setData] = useState<PricePoint[]>([]);
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/communities/id/${communityId}/price`);
            const payload = await res.json();
            if (payload.history) {
                setData(payload.history);
                setCurrentPrice(payload.price);
            }
        } catch (err) {
            console.error("Failed to fetch graph data", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 20000); // Polling every 20s
        return () => clearInterval(interval);
    }, [communityId]);

    const formatXAxis = (tickItem: number) => {
        const date = new Date(tickItem);
        return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">
                        {new Date(payload[0].payload.time).toLocaleTimeString()}
                    </p>
                    <p className="text-sm font-black text-orange-400">
                        {payload[0].value.toFixed(8)} SOL
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading && data.length === 0) {
        return (
            <div className="w-full h-64 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-center animate-pulse">
                <div className="text-gray-600 font-black uppercase tracking-widest text-xs">Synchronizing Market Data...</div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-4">
            <div className="flex items-end justify-between px-2">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Real-time Terminal</span>
                    </div>
                    <div className="text-3xl font-black text-white tracking-tighter">
                        {currentPrice?.toFixed(6)} <span className="text-orange-500 text-sm">SOL</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Pair Signal</div>
                    <div className="text-xs font-bold text-white uppercase">{tokenSymbol} / SOL</div>
                </div>
            </div>

            <div className="w-full h-72 relative">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                        <XAxis
                            dataKey="time"
                            hide={true}
                            domain={['auto', 'auto']}
                            scale="time"
                            type="number"
                        />
                        <YAxis
                            hide={true}
                            domain={['auto', 'auto']}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="price"
                            stroke="#f97316"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorPrice)"
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>

                {/* Legend/Axis replacement for aesthetics */}
                <div className="absolute bottom-0 left-0 w-full flex justify-between text-[8px] font-black text-gray-600 uppercase tracking-widest px-1 pointer-events-none">
                    <span>{data.length > 0 ? formatXAxis(data[0].time) : '-'}</span>
                    <span className="text-orange-900/40">Market Density Optimized</span>
                    <span>{data.length > 0 ? formatXAxis(data[data.length - 1].time) : '-'}</span>
                </div>
            </div>
        </div>
    );
}
