import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import THEME, { commonStyles, withOpacity } from '../styles/theme';

/**
 * Example screen showcasing the PlateMate minimalist dark theme
 * This demonstrates all major UI patterns and components
 */
const ExampleThemeScreen: React.FC = () => {
  const [switchValue, setSwitchValue] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Header with Icons */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color={THEME.text.primary} />
        </TouchableOpacity>
        <Text style={commonStyles.heading}>Theme Preview</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="settings-outline" size={24} color={THEME.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Typography Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Typography</Text>
          <View style={commonStyles.card}>
            <Text style={commonStyles.heading}>Heading Text</Text>
            <Text style={commonStyles.body}>
              Body text with optimal readability on pure black background.
              High contrast ensures comfort in any lighting condition.
            </Text>
            <Text style={commonStyles.caption}>
              Caption text for secondary information
            </Text>
          </View>
        </View>

        {/* Buttons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buttons</Text>
          
          {/* Primary Button */}
          <TouchableOpacity style={commonStyles.primaryButton}>
            <Text style={commonStyles.primaryButtonText}>Primary Button</Text>
          </TouchableOpacity>

          {/* Secondary Button */}
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Secondary Button</Text>
          </TouchableOpacity>

          {/* Ghost Button */}
          <TouchableOpacity style={styles.ghostButton}>
            <Text style={styles.ghostButtonText}>Ghost Button</Text>
          </TouchableOpacity>

          {/* Icon Button */}
          <TouchableOpacity style={styles.iconButtonLarge}>
            <Ionicons name="heart-outline" size={24} color={THEME.text.primary} />
            <Text style={styles.iconButtonText}>With Icon</Text>
          </TouchableOpacity>
        </View>

        {/* Input Fields Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Input Fields</Text>
          <TextInput
            style={commonStyles.input}
            placeholder="Enter text here..."
            placeholderTextColor={THEME.components.input.placeholder}
            value={inputValue}
            onChangeText={setInputValue}
          />

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Ionicons 
              name="search" 
              size={20} 
              color={THEME.text.tertiary}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={THEME.components.input.placeholder}
            />
          </View>
        </View>

        {/* Cards Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cards</Text>
          
          {/* Basic Card */}
          <View style={commonStyles.card}>
            <Text style={styles.cardTitle}>Basic Card</Text>
            <Text style={styles.cardBody}>
              Cards use subtle elevation with minimal shadow for depth
            </Text>
          </View>

          {/* Card with Shadow */}
          <View style={[commonStyles.card, THEME.shadows.md]}>
            <Text style={styles.cardTitle}>Card with Shadow</Text>
            <Text style={styles.cardBody}>
              White shadow with low opacity creates subtle depth
            </Text>
          </View>

          {/* Interactive Card */}
          <TouchableOpacity style={[commonStyles.card, styles.interactiveCard]}>
            <View style={styles.cardRow}>
              <Ionicons name="notifications-outline" size={24} color={THEME.text.primary} />
              <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>Interactive Card</Text>
                <Text style={styles.cardBody}>Tap to interact</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={THEME.text.tertiary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* List Items Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>List Items</Text>
          
          {/* Setting Item with Switch */}
          <View style={styles.listItem}>
            <Text style={styles.listItemText}>Enable Notifications</Text>
            <Switch
              value={switchValue}
              onValueChange={setSwitchValue}
              trackColor={{ false: THEME.border.medium, true: THEME.text.primary }}
              thumbColor={THEME.background.primary}
            />
          </View>

          <View style={commonStyles.divider} />

          {/* Navigation Item */}
          <TouchableOpacity style={styles.listItem}>
            <Text style={styles.listItemText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={20} color={THEME.text.tertiary} />
          </TouchableOpacity>

          <View style={commonStyles.divider} />

          {/* List Item with Icon */}
          <TouchableOpacity style={styles.listItem}>
            <Ionicons name="person-outline" size={20} color={THEME.text.primary} />
            <Text style={[styles.listItemText, { marginLeft: THEME.spacing.md }]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Indicators Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Indicators</Text>
          
          <View style={styles.statusContainer}>
            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: THEME.text.primary }]} />
              <Text style={styles.statusText}>Active</Text>
            </View>

            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: THEME.text.tertiary }]} />
              <Text style={styles.statusText}>Pending</Text>
            </View>

            <View style={styles.statusItem}>
              <View style={[styles.statusDot, { backgroundColor: THEME.text.disabled }]} />
              <Text style={styles.statusText}>Inactive</Text>
            </View>
          </View>
        </View>

        {/* Spacing Examples */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spacing System (8pt Grid)</Text>
          <View style={commonStyles.card}>
            <View style={[styles.spacingBox, { height: THEME.spacing.xs }]}>
              <Text style={styles.spacingLabel}>XS (4pt)</Text>
            </View>
            <View style={[styles.spacingBox, { height: THEME.spacing.sm }]}>
              <Text style={styles.spacingLabel}>SM (8pt)</Text>
            </View>
            <View style={[styles.spacingBox, { height: THEME.spacing.md }]}>
              <Text style={styles.spacingLabel}>MD (16pt)</Text>
            </View>
            <View style={[styles.spacingBox, { height: THEME.spacing.lg }]}>
              <Text style={styles.spacingLabel}>LG (24pt)</Text>
            </View>
          </View>
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: THEME.spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background.primary,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: THEME.spacing.md,
    paddingVertical: THEME.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border.light,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: THEME.spacing.md,
  },

  // Sections
  section: {
    marginTop: THEME.spacing.lg,
  },
  sectionTitle: {
    fontSize: THEME.typography.fontSize.sm,
    fontWeight: THEME.typography.fontWeight.semibold,
    color: THEME.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: THEME.spacing.md,
  },

  // Buttons
  secondaryButton: {
    backgroundColor: THEME.components.button.secondary.background,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
    minHeight: 44,
  },
  secondaryButtonText: {
    color: THEME.components.button.secondary.text,
    fontSize: THEME.typography.fontSize.md,
    fontWeight: THEME.typography.fontWeight.semibold,
  },
  ghostButton: {
    backgroundColor: THEME.components.button.ghost.background,
    borderWidth: 1,
    borderColor: THEME.components.button.ghost.border,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    alignItems: 'center',
    marginTop: THEME.spacing.sm,
    minHeight: 44,
  },
  ghostButtonText: {
    color: THEME.components.button.ghost.text,
    fontSize: THEME.typography.fontSize.md,
    fontWeight: THEME.typography.fontWeight.semibold,
  },
  iconButtonLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.background.tertiary,
    paddingVertical: THEME.spacing.md,
    paddingHorizontal: THEME.spacing.lg,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.border.default,
    marginTop: THEME.spacing.sm,
    minHeight: 44,
  },
  iconButtonText: {
    color: THEME.text.primary,
    fontSize: THEME.typography.fontSize.md,
    fontWeight: THEME.typography.fontWeight.medium,
    marginLeft: THEME.spacing.sm,
  },

  // Search Input
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.components.input.background,
    borderWidth: 1,
    borderColor: THEME.components.input.border,
    borderRadius: THEME.radius.md,
    marginTop: THEME.spacing.sm,
    paddingHorizontal: THEME.spacing.md,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: THEME.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: THEME.components.input.text,
    fontSize: THEME.typography.fontSize.md,
  },

  // Cards
  cardTitle: {
    fontSize: THEME.typography.fontSize.md,
    fontWeight: THEME.typography.fontWeight.semibold,
    color: THEME.text.primary,
    marginBottom: THEME.spacing.xs,
  },
  cardBody: {
    fontSize: THEME.typography.fontSize.sm,
    color: THEME.text.secondary,
    lineHeight: 20,
  },
  interactiveCard: {
    marginTop: THEME.spacing.sm,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: THEME.spacing.md,
  },

  // List Items
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: THEME.spacing.md,
    minHeight: 44,
  },
  listItemText: {
    fontSize: THEME.typography.fontSize.md,
    color: THEME.text.primary,
    flex: 1,
  },

  // Status Indicators
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: THEME.spacing.md,
    backgroundColor: THEME.background.tertiary,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.border.default,
  },
  statusItem: {
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: THEME.spacing.xs,
  },
  statusText: {
    fontSize: THEME.typography.fontSize.xs,
    color: THEME.text.secondary,
  },

  // Spacing Examples
  spacingBox: {
    backgroundColor: withOpacity(THEME.text.primary, 0.1),
    borderRadius: THEME.radius.sm,
    marginBottom: THEME.spacing.sm,
    justifyContent: 'center',
    paddingLeft: THEME.spacing.sm,
  },
  spacingLabel: {
    fontSize: THEME.typography.fontSize.xs,
    color: THEME.text.secondary,
  },
});

export default ExampleThemeScreen;
