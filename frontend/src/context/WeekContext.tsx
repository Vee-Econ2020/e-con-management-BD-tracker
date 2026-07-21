import React, { createContext, useContext, useState, useEffect } from 'react';

interface WeekContextType {
    selectedWeek: number | null;
    setSelectedWeek: (week: number) => void;
    availableWeeks: number[];
}

export const WeekContext = createContext<WeekContextType>({
    selectedWeek: null,
    setSelectedWeek: () => {},
    availableWeeks: []
});

export const WeekProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [availableWeeks, setAvailableWeeks] = useState<number[]>([]);

    useEffect(() => {
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            if (selectedWeek && typeof args[0] === 'string' && args[0].startsWith('/api/')) {
                // Don't append to /weeks/available to avoid loops
                if (!args[0].includes('/weeks/available')) {
                    const url = new URL(args[0], window.location.origin);
                    if (!url.searchParams.has('week')) {
                        url.searchParams.set('week', String(selectedWeek));
                        args[0] = url.pathname + url.search;
                    }
                }
            }
            return originalFetch.apply(this, args);
        };
        return () => {
            window.fetch = originalFetch;
        };
    }, [selectedWeek]);

    useEffect(() => {
        // Fetch available weeks
        fetch('/api/admin/weeks/available')
            .then(res => res.json())
            .then((data: number[]) => {
                setAvailableWeeks(data);
                // Fetch current week as default
                fetch('/api/week/current')
                    .then(res => res.json())
                    .then(current => {
                         if (!data.includes(current.week)) {
                             setAvailableWeeks(prev => [...prev, current.week].sort((a, b) => b - a));
                         }
                         setSelectedWeek(current.week);
                    });
            })
            .catch(err => console.error("Failed to fetch available weeks", err));
    }, []);

    return (
        <WeekContext.Provider value={{ selectedWeek, setSelectedWeek, availableWeeks }}>
            {children}
        </WeekContext.Provider>
    );
};

export const useWeek = () => useContext(WeekContext);
