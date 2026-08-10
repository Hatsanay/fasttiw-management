type Props = {
    percent: number; // 0-100
    size?: number;
    strokeWidth?: number;
    label?: string; // ข้อความกลางวงกลม เช่น "45%" หรือ "120/500" — ถ้าไม่ใส่จะโชว์ "N%" ให้เอง
    color?: string; // tailwind stroke class เช่น "stroke-blue-500"
};

export default function CircularProgress({
    percent,
    size = 120,
    strokeWidth = 10,
    label,
    color = "stroke-blue-500",
}: Props) {
    const clamped = Math.min(100, Math.max(0, percent));
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (clamped / 100) * circumference;

    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    fill="none"
                    className="stroke-gray-100"
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className={`${color} transition-[stroke-dashoffset] duration-200 ease-out`}
                />
            </svg>
            <span className="absolute text-xl font-semibold text-gray-700">
                {label ?? `${Math.round(clamped)}%`}
            </span>
        </div>
    );
}
