import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';

interface PasswordCriteriaProps {
  password: string;
}

export const PasswordCriteriaView: React.FC<PasswordCriteriaProps> = ({ password }) => {
  const criteria = [
    { label: '8 or more characters', valid: password.length >= 8 },
    { label: 'One uppercase letter (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', valid: /[a-z]/.test(password) },
    { label: 'One number (0-9)', valid: /[0-9]/.test(password) },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Password must contain:</Text>
      <View style={styles.grid}>
        {criteria.map((item, index) => (
          <View key={index} style={styles.row}>
            <Ionicons
              name={item.valid ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={item.valid ? Colors.success : '#94A3B8'}
              style={styles.icon}
            />
            <Text style={[styles.text, item.valid && styles.textValid]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 8,
    marginBottom: 14,
  },
  header: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  grid: {
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  textValid: {
    color: '#065F46',
    fontWeight: '600',
  },
});
