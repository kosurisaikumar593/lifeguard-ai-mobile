import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Colors } from '../theme/colors';

interface ShieldLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  inverted?: boolean;
}

export const ShieldLogo: React.FC<ShieldLogoProps> = ({ size = 'md', inverted = false }) => {
  const dimensions = {
    sm: { container: 42, image: 34 },
    md: { container: 68, image: 58 },
    lg: { container: 96, image: 82 },
    xl: { container: 120, image: 106 },
  }[size];

  return (
    <View
      style={[
        styles.container,
        {
          width: dimensions.container,
          height: dimensions.container,
          borderRadius: dimensions.container / 2,
          backgroundColor: inverted ? '#FFFFFF' : 'rgba(255, 255, 255, 0.95)',
          borderColor: inverted ? 'rgba(255, 255, 255, 0.5)' : '#E2E8F0',
          borderWidth: 1.5,
        },
      ]}
    >
      <Image
        source={require('../../assets/adaptive-icon.png')}
        style={{ width: dimensions.image, height: dimensions.image }}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});