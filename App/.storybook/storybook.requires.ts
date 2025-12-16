import { start } from '@storybook/react-native';

import '@storybook/addon-ondevice-controls/register';
import '@storybook/addon-ondevice-actions/register';
import '@storybook/addon-ondevice-backgrounds/register';

import Preview from './preview';

const stories = [
    // @ts-ignore
    require('../components/GameChart.stories.tsx'),
];

const view = start({
    annotations: [Preview],
    storyEntries: stories,
});

export { view };
