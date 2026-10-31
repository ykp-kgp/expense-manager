import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/tokens';

export default function TabsLayout() {
  const { ios } = useAppTheme();
  const p = ios.palette;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.tint,
        tabBarInactiveTintColor: p.secondaryLabel,
        tabBarStyle: {
          backgroundColor: p.groupedCard,
          borderTopColor: p.separator,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarLabelStyle: {
          fontSize: typography.caption2.fontSize,
          fontWeight: '500',
          letterSpacing: 0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Summary',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'chart-box' : 'chart-box-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'calendar-text' : 'calendar-text-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'chart-pie' : 'chart-arc'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cog' : 'cog-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
