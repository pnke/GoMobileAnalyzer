import React from 'react';
import { Svg, Rect, Path, Circle } from 'react-native-svg';
import { ColorValue } from 'react-native';

type GoBoardIconProps = {
    color: ColorValue;
    size?: number;
};

export const GoBoardIcon = ({ color, size = 28 }: GoBoardIconProps) => {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {/* Board Outline - slightly thinner stroke for elegance */}
            <Rect x="2" y="2" width="20" height="20" rx="2" stroke={color} strokeWidth="2" />

            {/* Grid Lines - Spaced at 5 units (2, 7, 12, 17, 22) to create 4x4 cells */}
            {/* Vertical Lines */}
            <Path d="M7 2V22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M12 2V22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M17 2V22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

            {/* Horizontal Lines */}
            <Path d="M2 7H22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M2 12H22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M2 17H22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

            {/* Star Point (Tengen) on the central intersection (12, 12) */}
            <Circle cx="12" cy="12" r="2.5" fill={color} />
        </Svg>
    );
};
