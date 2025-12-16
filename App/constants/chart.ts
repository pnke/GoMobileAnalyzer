
import { Dimensions } from 'react-native';

const screenWidth = Dimensions.get('window').width;

export const ChartConfig = {
    CHART_WIDTH: screenWidth * 0.95,
    CHART_HEIGHT: 220,
    Y_AXIS_PADDING: 40,
    VERTICAL_PADDING: 10,

    // Computed values (getters to ensure dynamic calculation if needed)
    get GRAPH_WIDTH() {
        return this.CHART_WIDTH - this.Y_AXIS_PADDING;
    },
    get GRAPH_HEIGHT() {
        return this.CHART_HEIGHT - 20;
    },

    // Styling
    STROKE_WIDTH_AXIS: 1.5,
    STROKE_WIDTH_LINE: 2.5,
    STROKE_WIDTH_INDICATOR: 2,
    RADIUS_DOT_ERROR: 5,
    RADIUS_DOT_CURRENT: 6,

    // Animation
    GESTURE_MIN_DIST: 5,
};
