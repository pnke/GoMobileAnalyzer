// GoAnalysisApp/components/GameChart.tsx

import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import { Circle, Line, Path, Rect, Svg } from 'react-native-svg';
import { useTranslation } from 'react-i18next';


import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { ChartConfig } from '../constants/chart';

type GameChartProps = {
  data: number[];
  title: string;
  onTitlePress: () => void;
  yRange: { min: number; max: number };
  yAxisLabels: string[];
  onSelectMove: (index: number) => void;
  onScrub: (index: number | null) => void;
  currentMoveIndex: number;
  errorIndices?: number[];
};


const createPath = (data: number[], yRange: { min: number; max: number }) => {
  if (data.length === 0) return '';
  const step = ChartConfig.GRAPH_WIDTH / (data.length - 1 || 1);
  const range = yRange.max - yRange.min || 1;

  const points = data.map((p, i) => {
    const x = i * step;
    const y = ChartConfig.GRAPH_HEIGHT - (((p - yRange.min) / range) * ChartConfig.GRAPH_HEIGHT) + ChartConfig.VERTICAL_PADDING;
    return { x, y };
  });

  return points.reduce(
    (acc, p, i) => (i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`),
    ''
  );
};

const AnimatedLine = Animated.createAnimatedComponent(Line);

// ... existing imports

export const GameChart = React.memo(({ data, title, onTitlePress, yRange, yAxisLabels, onSelectMove, onScrub, currentMoveIndex, errorIndices = [] }: GameChartProps) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const indicatorX = useSharedValue(-1);

  const animatedIndicatorProps = useAnimatedProps(() => ({
    x1: indicatorX.value, y1: 0, x2: indicatorX.value, y2: ChartConfig.CHART_HEIGHT,
    display: indicatorX.value < 0 ? 'none' : 'flex',
  }));

  // Memoize expensive path calculation - MUST be before any conditional returns
  const path = useMemo(
    () => (data && data.length >= 2) ? createPath(data, yRange) : '',
    [data, yRange]
  );

  // Compute derived values - MUST be before conditional returns
  const totalMoves = data?.length ?? 0;
  const range = (yRange.max - yRange.min) || 1;
  const currentMoveX = (ChartConfig.GRAPH_WIDTH / (totalMoves - 1 || 1)) * currentMoveIndex;
  const currentMoveValue = data?.[currentMoveIndex] ?? 0;
  const currentMoveY = ChartConfig.GRAPH_HEIGHT - (((currentMoveValue - yRange.min) / range) * ChartConfig.GRAPH_HEIGHT) + ChartConfig.VERTICAL_PADDING;
  const midPointValue = yRange.min < 0 && yRange.max > 0 ? 0 : 50;
  const midPointY = ChartConfig.GRAPH_HEIGHT - (((midPointValue - yRange.min) / range) * ChartConfig.GRAPH_HEIGHT) + ChartConfig.VERTICAL_PADDING;

  // Memoize error circles - MUST be before conditional returns
  const errorCircles = useMemo(() => {
    if (!data || data.length < 2) return [];
    return errorIndices.map(index => {
      const errorX = (ChartConfig.GRAPH_WIDTH / (totalMoves - 1 || 1)) * index;
      const errorValue = data[index] ?? 0;
      const errorY = ChartConfig.GRAPH_HEIGHT - (((errorValue - yRange.min) / range) * ChartConfig.GRAPH_HEIGHT) + ChartConfig.VERTICAL_PADDING;
      return <Circle key={`error-${index}`} cx={errorX} cy={errorY} r={ChartConfig.RADIUS_DOT_ERROR} fill={colors.deltaPositive} />;
    });
  }, [errorIndices, data, yRange, range, totalMoves, colors.deltaPositive]);

  if (!data || data.length < 2) {
    return (
      <View testID="game-chart" style={[styles.container, { backgroundColor: colors.chartBackground }]}>
        <TouchableOpacity testID="toggle-analysis-mode" onPress={onTitlePress} style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.chartText }]}>{t('chart.fallback.title')} ⇄</Text>
        </TouchableOpacity>
        <Text style={[styles.fallbackText, { color: colors.icon }]}>{t('chart.fallback.noData')}</Text>
      </View>
    );
  }

  // Gesture handlers (not hooks, so can be after conditional return)
  const panGesture = Gesture.Pan()
    .minDistance(ChartConfig.GESTURE_MIN_DIST)
    .onBegin((event) => {
      const position = Math.max(0, Math.min(event.x, ChartConfig.GRAPH_WIDTH));
      indicatorX.value = position;
      const index = Math.round((position / ChartConfig.GRAPH_WIDTH) * (totalMoves - 1));
      if (index >= 0 && index < totalMoves) {
        runOnJS(onScrub)(index);
      }
    })
    .onUpdate((event) => {
      const position = Math.max(0, Math.min(event.x, ChartConfig.GRAPH_WIDTH));
      indicatorX.value = position;
      const index = Math.round((position / ChartConfig.GRAPH_WIDTH) * (totalMoves - 1));
      if (index >= 0 && index < totalMoves) {
        runOnJS(onScrub)(index);
      }
    })
    .onEnd((event) => {
      const position = Math.max(0, Math.min(event.x, ChartConfig.GRAPH_WIDTH));
      const index = Math.round((position / ChartConfig.GRAPH_WIDTH) * (totalMoves - 1));
      if (index >= 0 && index < totalMoves) {
        runOnJS(onSelectMove)(index);
      }
      indicatorX.value = -1;
      runOnJS(onScrub)(null);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((event, success) => {
      if (!success) return;
      const index = Math.round((event.x / ChartConfig.GRAPH_WIDTH) * (totalMoves - 1));
      if (index >= 0 && index < totalMoves) {
        runOnJS(onSelectMove)(index);
      }
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);
  return (
    <View
      testID="game-chart"
      style={[styles.container, { backgroundColor: colors.chartBackground }]}
      accessible={true}
      accessibilityLabel={t('chart.accessibility.label', { title })}
      accessibilityHint={t('chart.accessibility.hint')}
      accessibilityRole="image"
    >
      <TouchableOpacity
        testID="toggle-analysis-mode"
        onPress={onTitlePress}
        style={styles.titleContainer}
        accessibilityRole="button"
        accessibilityLabel={t('chart.accessibility.toggleMode')}
      >
        <Text style={[styles.title, { color: colors.chartText }]}>{title} ⇄</Text>
      </TouchableOpacity>

      <View style={styles.chartContainer}>
        <View style={styles.yAxisContainer} importantForAccessibility="no-hide-descendants">
          {yAxisLabels.map((label) => <Text key={label} style={[styles.yAxisLabel, { color: colors.icon }]}>{label}</Text>)}
        </View>

        <GestureDetector gesture={composedGesture}>
          <Svg height={ChartConfig.CHART_HEIGHT} width={ChartConfig.GRAPH_WIDTH} accessible={false}>
            <Rect x="0" y="0" width={ChartConfig.GRAPH_WIDTH} height={midPointY} fill={colors.chartBlackArea} />
            <Rect x="0" y={midPointY} width={ChartConfig.GRAPH_WIDTH} height={ChartConfig.CHART_HEIGHT - midPointY} fill={colors.chartWhiteArea} />
            <Line x1="0" y1={midPointY} x2={ChartConfig.GRAPH_WIDTH} y2={midPointY} stroke={colors.chartLine} strokeWidth={ChartConfig.STROKE_WIDTH_AXIS} />

            <Path d={path} fill="none" stroke={colors.chartText} strokeWidth={ChartConfig.STROKE_WIDTH_LINE} />
            {errorCircles}
            {currentMoveIndex >= 0 && !isNaN(currentMoveY) && (
              <Circle cx={currentMoveX} cy={currentMoveY} r={ChartConfig.RADIUS_DOT_CURRENT} stroke={colors.background} strokeWidth={2} fill={colors.tint} />
            )}
            <AnimatedLine animatedProps={animatedIndicatorProps} stroke={colors.chartText} strokeWidth={ChartConfig.STROKE_WIDTH_INDICATOR} strokeDasharray="5,5" />
          </Svg>
        </GestureDetector>
      </View>
    </View>
  );
});

GameChart.displayName = 'GameChart';

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: 'center',
    paddingVertical: ChartConfig.VERTICAL_PADDING,
    borderRadius: 16,
    width: ChartConfig.CHART_WIDTH,
    minHeight: ChartConfig.CHART_HEIGHT + 40,
  },
  titleContainer: {
    padding: 5,
    borderRadius: 5,
  },
  title: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  chartContainer: { flexDirection: 'row' },
  yAxisContainer: {
    width: ChartConfig.Y_AXIS_PADDING,
    height: ChartConfig.CHART_HEIGHT,
    justifyContent: 'space-between',
    paddingVertical: ChartConfig.VERTICAL_PADDING - 5,
    alignItems: 'center',
  },
  yAxisLabel: {
    fontSize: 12,
  },
  fallbackText: {
    fontSize: 14,
  },
});
