import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
    Path,
    Circle,
    Text as SvgText,
    Line,
    Defs,
    LinearGradient,
    Stop,
    Rect
} from 'react-native-svg';

const { width: screenWidth } = Dimensions.get('window');

interface WeightLossComparisonChartProps {
    successPercentage?: number;
}

const WeightLossComparisonChart: React.FC<WeightLossComparisonChartProps> = ({
    successPercentage = 78
}) => {
    const chartWidth = screenWidth - 40;
    const chartHeight = 280;
    const padding = 40;
    const innerWidth = chartWidth - 2 * padding;
    const innerHeight = chartHeight - 2 * padding;

    // Data points for 6 months (normalized to chart dimensions)
    const months = ['Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6'];

    // Traditional diet curve - starts high, drops quickly, then climbs back up
    const traditionalDietPoints = [
        { x: 0, y: 0.2 },      // Month 1 - starting point
        { x: 0.2, y: 0.6 },    // Month 2 - rapid initial loss
        { x: 0.4, y: 0.65 },   // Month 3 - slight plateau
        { x: 0.6, y: 0.45 },   // Month 4 - weight regain starts
        { x: 0.8, y: 0.25 },   // Month 5 - more regain
        { x: 1, y: 0.15 }      // Month 6 - back near starting point
    ];

    // PlateMate curve - steady, consistent decline
    const plateMatePoints = [
        { x: 0, y: 0.2 },      // Month 1 - same starting point
        { x: 0.2, y: 0.35 },   // Month 2 - moderate loss
        { x: 0.4, y: 0.5 },    // Month 3 - continued progress
        { x: 0.6, y: 0.55 },   // Month 4 - slight plateau (realistic)
        { x: 0.8, y: 0.7 },    // Month 5 - continued loss
        { x: 1, y: 0.8 }       // Month 6 - sustained weight loss
    ];

    // Convert normalized points to actual coordinates
    const convertToCoords = (points: { x: number; y: number }[]) => {
        return points.map(point => ({
            x: padding + point.x * innerWidth,
            y: padding + point.y * innerHeight
        }));
    };

    const traditionalCoords = convertToCoords(traditionalDietPoints);
    const plateMateCoords = convertToCoords(plateMatePoints);

    // Create SVG path strings
    const createPath = (coords: { x: number; y: number }[]) => {
        let path = `M ${coords[0].x} ${coords[0].y}`;
        for (let i = 1; i < coords.length; i++) {
            const prev = coords[i - 1];
            const curr = coords[i];
            const cp1x = prev.x + (curr.x - prev.x) / 3;
            const cp1y = prev.y;
            const cp2x = curr.x - (curr.x - prev.x) / 3;
            const cp2y = curr.y;
            path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
        }
        return path;
    };

    const traditionalPath = createPath(traditionalCoords);
    const platematePath = createPath(plateMateCoords);

    // Create fill path for traditional diet
    const traditionalFillPath = traditionalPath + ` L ${traditionalCoords[traditionalCoords.length - 1].x} ${padding + innerHeight} L ${traditionalCoords[0].x} ${padding + innerHeight} Z`;

    return (
        <View style={styles.container}>
            {/* Chart Title */}
            <View style={styles.header}>
                <Text style={styles.title}>Your weight</Text>

                {/* Legend */}
                <View style={styles.legend}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
                        <Text style={styles.legendText}>Traditional diet</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#000000' }]} />
                        <Text style={styles.legendText}>PlateMate</Text>
                    </View>
                </View>
            </View>

            {/* Chart */}
            <Svg width={chartWidth} height={chartHeight} style={styles.chart}>
                <Defs>
                    <LinearGradient id="traditionalGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="0.3" />
                        <Stop offset="100%" stopColor="#FF6B6B" stopOpacity="0.05" />
                    </LinearGradient>
                </Defs>

                {/* Background */}
                <Rect x="0" y="0" width={chartWidth} height={chartHeight} fill="white" />

                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((ratio, index) => (
                    <Line
                        key={index}
                        x1={padding}
                        y1={padding + ratio * innerHeight}
                        x2={padding + innerWidth}
                        y2={padding + ratio * innerHeight}
                        stroke="#E5E5E5"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                    />
                ))}

                {/* Traditional diet fill */}
                <Path
                    d={traditionalFillPath}
                    fill="url(#traditionalGradient)"
                />

                {/* Traditional diet line */}
                <Path
                    d={traditionalPath}
                    stroke="#FF6B6B"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* PlateMate line */}
                <Path
                    d={platematePath}
                    stroke="#000000"
                    strokeWidth="3"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Start and end point markers */}
                {/* Traditional diet markers */}
                <Circle
                    cx={traditionalCoords[0].x}
                    cy={traditionalCoords[0].y}
                    r="4"
                    fill="#FF6B6B"
                />
                <Circle
                    cx={traditionalCoords[traditionalCoords.length - 1].x}
                    cy={traditionalCoords[traditionalCoords.length - 1].y}
                    r="4"
                    fill="#FF6B6B"
                />

                {/* PlateMate markers */}
                <Circle
                    cx={plateMateCoords[0].x}
                    cy={plateMateCoords[0].y}
                    r="4"
                    fill="#000000"
                />
                <Circle
                    cx={plateMateCoords[plateMateCoords.length - 1].x}
                    cy={plateMateCoords[plateMateCoords.length - 1].y}
                    r="4"
                    fill="#000000"
                />

                {/* X-axis labels */}
                {months.map((month, index) => (
                    <SvgText
                        key={index}
                        x={padding + (index / (months.length - 1)) * innerWidth}
                        y={chartHeight - 10}
                        fontSize="12"
                        fill="#666666"
                        textAnchor="middle"
                    >
                        {month}
                    </SvgText>
                ))}
            </Svg>

            {/* Caption */}
            <Text style={styles.caption}>
                {successPercentage}% of PlateMate users maintain their weight loss even 6 months later
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginHorizontal: 20,
        marginVertical: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000000',
    },
    legend: {
        alignItems: 'flex-end',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 8,
    },
    legendText: {
        fontSize: 14,
        color: '#666666',
        fontWeight: '500',
    },
    chart: {
        alignSelf: 'center',
    },
    caption: {
        fontSize: 14,
        color: '#666666',
        textAlign: 'center',
        marginTop: 16,
        fontStyle: 'italic',
    },
});

export default WeightLossComparisonChart; 