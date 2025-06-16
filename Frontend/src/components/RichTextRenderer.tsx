import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from "expo-linear-gradient";

interface RichTextRendererProps {
    text: string;
    baseStyle?: object;
}

const RichTextRenderer: React.FC<RichTextRendererProps> = ({ text, baseStyle = {} }) => {
    if (!text) return null;

    // Pre-process text to remove common issues
    let processedText = text;

    // Remove "Introduction:" at the beginning (case-insensitive)
    processedText = processedText.replace(/^(introduction:|introduction)\s*/i, '');

    // Replace "---" with empty line
    processedText = processedText.replace(/\n---\n/g, '\n\n');
    processedText = processedText.replace(/^---\n/g, '\n');
    processedText = processedText.replace(/\n---$/g, '\n');
    processedText = processedText.replace(/^---$/g, '');

    // Remove quotes around text that wrap entire paragraphs
    processedText = processedText.replace(/^"(.+)"$/gm, '$1');

    // Process headings, bold, italics, and lists
    const processText = () => {
        const lines = processedText.split('\n');
        const elements: ReactNode[] = [];

        let inList = false;
        let listItems: ReactNode[] = [];
        let listType: 'bullet' | 'ordered' | null = null;

        const finishList = () => {
            if (inList && listItems.length > 0) {
                elements.push(
                    <View key={`list-${elements.length}`} style={styles.list}>
                        {listItems}
                    </View>
                );
                listItems = [];
                inList = false;
                listType = null;
            }
        };

        lines.forEach((line, i) => {
            line = line.trim();
            if (!line) {
                finishList();
                elements.push(<View key={`space-${i}`} style={styles.paragraphSpace} />);
                return;
            }

            // Check for headings
            if (line.startsWith('# ')) {
                finishList();
                elements.push(
                    <View key={`h1-${i}`} style={styles.headingContainer}>
                        <LinearGradient
                            colors={["#5A60EA", "#FF00F5"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.headingGradient}
                        >
                            <Text style={styles.heading1}>
                                {line.substring(2)}
                            </Text>
                        </LinearGradient>
                    </View>
                );
                return;
            }

            if (line.startsWith('## ')) {
                finishList();
                elements.push(
                    <Text key={`h2-${i}`} style={styles.heading2}>
                        {line.substring(3)}
                    </Text>
                );
                return;
            }

            if (line.startsWith('### ')) {
                finishList();
                elements.push(
                    <Text key={`h3-${i}`} style={styles.heading3}>
                        {line.substring(4)}
                    </Text>
                );
                return;
            }

            // Check for lists
            const bulletMatch = line.match(/^[*\-•] (.+)/);
            const orderedMatch = line.match(/^(\d+)\. (.+)/);

            if (bulletMatch) {
                if (!inList || listType !== 'bullet') {
                    finishList();
                    inList = true;
                    listType = 'bullet';
                }

                listItems.push(
                    <View key={`bullet-${i}`} style={styles.listItem}>
                        <View style={styles.bulletPoint} />
                        <Text style={[styles.listItemText, baseStyle]}>
                            {processInlineStyles(bulletMatch[1])}
                        </Text>
                    </View>
                );
                return;
            }

            if (orderedMatch) {
                if (!inList || listType !== 'ordered') {
                    finishList();
                    inList = true;
                    listType = 'ordered';
                }

                listItems.push(
                    <View key={`ordered-${i}`} style={styles.listItem}>
                        <View style={styles.numberContainer}>
                            <Text style={styles.numberText}>{orderedMatch[1]}</Text>
                        </View>
                        <Text style={[styles.listItemText, baseStyle]}>
                            {processInlineStyles(orderedMatch[2])}
                        </Text>
                    </View>
                );
                return;
            }

            // Regular paragraph
            finishList();
            elements.push(
                <Text key={`p-${i}`} style={[styles.paragraph, baseStyle]}>
                    {processInlineStyles(line)}
                </Text>
            );
        });

        finishList();
        return elements;
    };

    // Process inline styles (bold, italic, etc.)
    const processInlineStyles = (text: string) => {
        // Improved regex for bold text that matches non-greedily
        let parts = text.split(/(\*\*[^*]+\*\*)/g);
        return parts.map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
                return <Text key={i} style={styles.bold}>{part.substring(2, part.length - 2)}</Text>;
            }

            // Process italics in the remaining text with improved regex
            let italicParts = part.split(/(\*[^*]+\*)/g);
            if (italicParts.length === 1) {
                return part;
            }

            return italicParts.map((italicPart, j) => {
                if (italicPart.startsWith('*') && italicPart.endsWith('*') && italicPart.length > 2) {
                    return <Text key={`${i}-${j}`} style={styles.italic}>{italicPart.substring(1, italicPart.length - 1)}</Text>;
                }
                return italicPart;
            });
        });
    };

    return <View style={styles.container}>{processText()}</View>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headingContainer: {
        marginVertical: 8,
        borderRadius: 8,
        overflow: 'hidden',
    },
    headingGradient: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    heading1: {
        fontSize: 22,
        color: 'white',
        fontWeight: 'bold',
    },
    heading2: {
        fontSize: 20,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 6,
        marginTop: 10,
    },
    heading3: {
        fontSize: 18,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 5,
        marginTop: 8,
    },
    paragraph: {
        fontSize: 16,
        color: 'white',
        lineHeight: 22,
        marginBottom: 8,
    },
    paragraphSpace: {
        height: 8,
    },
    bold: {
        fontWeight: 'bold',
        color: 'white',
    },
    italic: {
        fontStyle: 'italic',
        color: 'white',
    },
    list: {
        marginBottom: 8,
        marginTop: 4,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    bulletPoint: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#5A60EA',
        marginTop: 8,
        marginRight: 8,
    },
    numberContainer: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(90, 96, 234, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    numberText: {
        color: '#5A60EA',
        fontSize: 12,
        fontWeight: 'bold',
    },
    listItemText: {
        flex: 1,
        fontSize: 16,
        color: 'white',
        lineHeight: 22,
    },
});

export default RichTextRenderer; 