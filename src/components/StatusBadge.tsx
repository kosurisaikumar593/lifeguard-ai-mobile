import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../theme/colors';

interface StatusBadgeProps {
  label: string;
  status?: 'active' | 'inactive' | 'emergency' | 'warning' | 'info';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status = 'active',
  size = 'md',
  style,
}) => {
  const config = {
    active: { bg: '#ECFDF5', dot: Colors.success, text: '#065F46', border: '#A7F3D0' },
    inactive: { bg: '#F1F5F9', dot: '#94A3B8', text: '#475569', border: '#E2E8F0' },
    emergency: { bg: '#FEF2F2', dot: Colors.danger, text: '#991B1B', border: '#FECACA' },
    warning: { bg: '#FFFBEB', dot: Colors.warning, text: '#92400E', border: '#FDE68A' },
    info: { bg: '#EFF6FF', dot: Colors.primary, text: '#1E40AF', border: '#BFDBFE' },
  }[status];

  const textSizeStyle = size === 'sm' ? styles.smText : styles.mdText;

  return (
    <View
      style={[
        styles.badge,
        styles[size],
        { backgroundColor: config.bg, borderColor: config.border },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.text, textSizeStyle, { color: config.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  smText: {
    fontSize: 11,
  },
  mdText: {
    fontSize: 12,
  },
});
