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

    // Remove "Introduction:" at the beginning (case-insensitive) with more patterns
    processedText = processedText.replace(/^(introduction:|introduction|intro:|intro)(\s*)/i, '');
    processedText = processedText.replace(/^\s*["'](.+)["']\s*$/, '$1'); // Remove surrounding quotes from entire text

    // Remove quotes around text that wrap entire paragraphs
    processedText = processedText.replace(/^"(.+)"$/gm, '$1');
    processedText = processedText.replace(/^"(.+)$/gm, '$1');
    processedText = processedText.replace(/^(.+)"$/gm, '$1');
    processedText = processedText.replace(/^'(.+)'$/gm, '$1');

    // Remove quotes from short comments/notes
    processedText = processedText.replace(/(?:^|\n)"([^"]+?)"(?=\n|$)/g, '$1');
    processedText = processedText.replace(/(?:^|\n)'([^']+?)'(?=\n|$)/g, '$1');

    // Enhanced replacement of "---" with empty lines
    processedText = processedText.replace(/\n---\n/g, '\n\n');  // Between paragraphs
    processedText = processedText.replace(/^---\n/g, '\n');     // At beginning
    processedText = processedText.replace(/\n---$/g, '\n');     // At end  
    processedText = processedText.replace(/^---$/g, '');        // Entire content is just ---
    processedText = processedText.replace(/\n\s*---\s*\n/g, '\n\n'); // With whitespace
    processedText = processedText.replace(/(?<=\n)---(?=\n)/g, '');  // Standalone line

    // Add extra spacing after section titles
    processedText = processedText.replace(/^(.*:)$/gm, '$1\n');

    // Process headings, bold, italics, and lists
    const processText = () => {
        const lines = processedText.split('\n');
        const elements: ReactNode[] = [];

        let inList = false;
        let listItems: ReactNode[] = [];
        let listType: 'bullet' | 'ordered' | null = null;
        let inSection = false;
        let lastLineWasHeader = false;

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
                // Add more space after headers
                if (lastLineWasHeader) {
                    lastLineWasHeader = false;
                } else {
                    elements.push(<View key={`space-${i}`} style={styles.paragraphSpace} />);
                }
                return;
            }

            // Check for section headers (lines ending with colon)
            if (line.endsWith(':') && !line.includes('://')) {
                finishList();

                // This is a section header
                elements.push(
                    <Text key={`section-${i}`} style={styles.sectionHeader}>
                        {line}
                    </Text>
                );
                lastLineWasHeader = true;
                inSection = true;
                return;
            }

            // Check for headings
            if (line.startsWith('# ')) {
                finishList();
                // Clean up the heading text by removing extra asterisks
                let headingText = line.substring(2);
                // Remove surrounding asterisks from headings (e.g., "**Heading**" -> "Heading")
                headingText = headingText.replace(/^\*\*(.*)\*\*$/, '$1');

                elements.push(
                    <View key={`h1-${i}`} style={styles.headingContainer}>
                        <LinearGradient
                            colors={["#5A60EA", "#FF00F5"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.headingGradient}
                        >
                            <Text style={styles.heading1}>
                                {headingText}
                            </Text>
                        </LinearGradient>
                    </View>
                );
                lastLineWasHeader = true;
                return;
            }

            if (line.startsWith('## ')) {
                finishList();
                // Clean up the heading text
                let headingText = line.substring(3);
                headingText = headingText.replace(/^\*\*(.*)\*\*$/, '$1');

                elements.push(
                    <Text key={`h2-${i}`} style={styles.heading2}>
                        {headingText}
                    </Text>
                );
                lastLineWasHeader = true;
                return;
            }

            if (line.startsWith('### ')) {
                finishList();
                // Clean up the heading text
                let headingText = line.substring(4);
                headingText = headingText.replace(/^\*\*(.*)\*\*$/, '$1');

                elements.push(
                    <Text key={`h3-${i}`} style={styles.heading3}>
                        {headingText}
                    </Text>
                );
                lastLineWasHeader = true;
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
                lastLineWasHeader = false;
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
                lastLineWasHeader = false;
                return;
            }

            // Regular paragraph - add indentation if we're inside a section
            finishList();

            // Add indentation for lines after a section header
            const textStyle = inSection ? [styles.paragraph, styles.indentedParagraph, baseStyle] : [styles.paragraph, baseStyle];

            elements.push(
                <Text key={`p-${i}`} style={textStyle}>
                    {processInlineStyles(line)}
                </Text>
            );
            lastLineWasHeader = false;
        });

        finishList();
        return elements;
    };

    // Completely revamped inline style processing function
    const processInlineStyles = (text: string) => {
        // Step 1: Create a function to process bold text first
        const processBoldText = (inputText: string) => {
            // If no ** is found, return the text as is
            if (!inputText.includes('**')) return inputText;

            const result: React.ReactNode[] = [];
            let currentText = inputText;
            let startIndex = 0;
            let openTagIndex = -1;

            // Process the string character by character to find matching ** pairs
            while (startIndex < currentText.length) {
                const nextTagIndex = currentText.indexOf('**', startIndex);

                // No more ** found
                if (nextTagIndex === -1) {
                    result.push(currentText.substring(startIndex));
                    break;
                }

                // Found a **
                if (openTagIndex === -1) {
                    // This is an opening tag
                    result.push(currentText.substring(startIndex, nextTagIndex));
                    openTagIndex = nextTagIndex;
                    startIndex = nextTagIndex + 2; // Move past the **
                } else {
                    // This is a closing tag - we have a complete bold section
                    const boldContent = currentText.substring(openTagIndex + 2, nextTagIndex);
                    if (boldContent) { // Only add if there's actual content
                        result.push(
                            <Text key={`bold-${openTagIndex}`} style={styles.bold}>
                                {boldContent}
                            </Text>
                        );
                    }
                    openTagIndex = -1; // Reset to look for next opening tag
                    startIndex = nextTagIndex + 2; // Move past the closing **
                }
            }

            return result;
        };

        // Step 2: Create a function to process italic text
        const processItalicText = (inputNode: React.ReactNode): React.ReactNode => {
            if (typeof inputNode !== 'string') {
                return inputNode;
            }

            const inputText = inputNode as string;
            // If no * is found, return the text as is
            if (!inputText.includes('*')) return inputText;

            const result: React.ReactNode[] = [];
            let currentText = inputText;
            let startIndex = 0;
            let openTagIndex = -1;

            // Process the string character by character
            while (startIndex < currentText.length) {
                const nextTagIndex = currentText.indexOf('*', startIndex);

                // No more * found
                if (nextTagIndex === -1) {
                    result.push(currentText.substring(startIndex));
                    break;
                }

                // Found a *
                if (openTagIndex === -1) {
                    // This is an opening tag
                    result.push(currentText.substring(startIndex, nextTagIndex));
                    openTagIndex = nextTagIndex;
                    startIndex = nextTagIndex + 1; // Move past the *
                } else {
                    // This is a closing tag - we have a complete italic section
                    const italicContent = currentText.substring(openTagIndex + 1, nextTagIndex);
                    if (italicContent) { // Only add if there's actual content
                        result.push(
                            <Text key={`italic-${openTagIndex}`} style={styles.italic}>
                                {italicContent}
                            </Text>
                        );
                    }
                    openTagIndex = -1; // Reset to look for next opening tag
                    startIndex = nextTagIndex + 1; // Move past the closing *
                }
            }

            return result;
        };

        // Step 3: Process bold text first, then process italic text within the remaining parts
        const boldProcessed = processBoldText(text);

        // Step 4: If boldProcessed is a string, process it for italics, otherwise process each element
        if (typeof boldProcessed === 'string') {
            return processItalicText(boldProcessed);
        } else {
            // Process each element in the boldProcessed array
            return boldProcessed.map((item, index) => {
                if (typeof item === 'string') {
                    return processItalicText(item);
                }
                return item; // Already a React element
            });
        }
    };

    return <View style={styles.container}>{processText()}</View>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headingContainer: {
        marginVertical: 12,
        borderRadius: 8,
        overflow: 'hidden',
    },
    headingGradient: {
        paddingVertical: 8,
        paddingHorizontal: 12,
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
        marginBottom: 8,
        marginTop: 12,
    },
    heading3: {
        fontSize: 18,
        color: 'white',
        fontWeight: 'bold',
        marginBottom: 6,
        marginTop: 10,
    },
    sectionHeader: {
        fontSize: 18,
        color: 'white',
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 4,
    },
    paragraph: {
        fontSize: 16,
        color: 'white',
        lineHeight: 22,
        marginBottom: 4,
    },
    indentedParagraph: {
        paddingLeft: 8,
        marginBottom: 4,
        marginTop: 0,
    },
    paragraphSpace: {
        height: 6,
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
        marginBottom: 12,
        marginTop: 4,
    },
    listItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 8,
        paddingLeft: 8,
    },
    bulletPoint: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF00F5',
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