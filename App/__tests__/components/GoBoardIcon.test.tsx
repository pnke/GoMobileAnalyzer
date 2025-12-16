
import React from 'react';
import { render } from '@testing-library/react-native';
import { GoBoardIcon } from '../../components/ui/GoBoardIcon';

describe('GoBoardIcon', () => {
    it('renders without crashing', () => {
        const { toJSON } = render(<GoBoardIcon color="black" size={24} />);
        expect(toJSON()).toMatchSnapshot();
    });

    it('renders with default size', () => {
        const { toJSON } = render(<GoBoardIcon color="white" />);
        expect(toJSON()).toMatchSnapshot();
    });
});
