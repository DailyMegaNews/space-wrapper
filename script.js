class SpaceWrapper {
    constructor() {
        this.mode = 'A';
        this.protectedMap = new Map();
        this.nextTokenId = 1;
        
        this.initializeElements();
        this.setupEventListeners();
        this.updateInputStats();
    }
    
    initializeElements() {
        this.inputText = document.getElementById('inputText');
        this.outputText = document.getElementById('outputText');
        this.processBtn = document.getElementById('processBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.modeRadios = document.querySelectorAll('input[name="mode"]');
        this.warningBanner = document.getElementById('warningBanner');
        this.warningText = document.getElementById('warningText');
        
        // Stats elements
        this.inputWordCount = document.getElementById('inputWordCount');
        this.inputCharCount = document.getElementById('inputCharCount');
        this.inputLineCount = document.getElementById('inputLineCount');
        this.outputWordCount = document.getElementById('outputWordCount');
        this.outputCharCount = document.getElementById('outputCharCount');
        this.lineBreaksRemoved = document.getElementById('lineBreaksRemoved');
        
        // Verification elements
        this.wordMatch = document.getElementById('wordMatch');
        this.charMatch = document.getElementById('charMatch');
        this.contentMatch = document.getElementById('contentMatch');
    }
    
    setupEventListeners() {
        this.processBtn.addEventListener('click', () => this.processText());
        this.clearBtn.addEventListener('click', () => this.clearInput());
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        
        this.modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.mode = e.target.value;
            });
        });
        
        this.inputText.addEventListener('input', () => {
            this.updateInputStats();
            this.clearOutput();
        });
    }
    
    updateInputStats() {
        const text = this.inputText.value;
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        const lines = text ? text.split('\n').length : 0;
        
        this.inputWordCount.textContent = `Words: ${words}`;
        this.inputCharCount.textContent = `Chars: ${chars}`;
        this.inputLineCount.textContent = `Lines: ${lines}`;
    }
    
    clearInput() {
        this.inputText.value = '';
        this.updateInputStats();
        this.clearOutput();
    }
    
    clearOutput() {
        this.outputText.textContent = '';
        this.copyBtn.disabled = true;
        this.warningBanner.style.display = 'none';
        
        // Reset stats
        this.outputWordCount.textContent = 'Words: 0';
        this.outputCharCount.textContent = 'Chars: 0';
        this.lineBreaksRemoved.textContent = 'Line breaks removed: 0';
        
        // Reset verification
        this.wordMatch.textContent = '✓';
        this.wordMatch.className = 'verification-value match';
        this.charMatch.textContent = '✓';
        this.charMatch.className = 'verification-value match';
        this.contentMatch.textContent = '✓';
        this.contentMatch.className = 'verification-value match';
    }
    
    processText() {
        const input = this.inputText.value;
        if (!input.trim()) {
            this.outputText.textContent = '';
            return;
        }
        
        // Reset protected content tracking
        this.protectedMap.clear();
        this.nextTokenId = 1;
        
        try {
            // Process each batch independently (separated by blank lines)
            const batches = this.splitIntoBatches(input);
            const processedBatches = batches.map(batch => this.processBatch(batch));
            
            // Join batches with exactly one blank line
            const output = processedBatches.join('\n\n');
            
            // Display output
            this.outputText.textContent = output;
            this.copyBtn.disabled = false;
            
            // Update stats and verification
            this.updateOutputStats(input, output);
            this.verifyContentIntegrity(input, output);
            
        } catch (error) {
            console.error('Processing error:', error);
            this.outputText.textContent = `Error: ${error.message}\n\nOriginal text:\n\n${input}`;
            this.showWarning('Processing error occurred. Original text preserved.');
        }
    }
    
    splitIntoBatches(text) {
        // Split by two or more newlines (blank line separation)
        return text.split(/\n\s*\n/).filter(batch => batch.trim());
    }
    
    processBatch(batch) {
        // Step 1: Protect content and structure
        const protectedText = this.protectStructureAndContent(batch);
        
        // Step 2: Normalize whitespace while preserving structure
        const normalized = this.normalizeWhitespaceWithStructure(protectedText);
        
        // Step 3: Apply mode-specific processing
        let processed;
        switch(this.mode) {
            case 'A':
                processed = this.processModeAWithStructure(normalized);
                break;
            case 'B':
                processed = this.processModeBWithStructure(normalized);
                break;
            case 'C':
                processed = this.processModeCWithStructure(normalized);
                break;
            default:
                processed = normalized;
        }
        
        // Step 4: Restore protected content
        const restored = this.restoreProtectedContent(processed);
        
        // Step 5: Final cleanup with structure awareness
        return this.finalCleanupWithStructure(restored);
    }
    
    protectStructureAndContent(text) {
        let protectedText = text;
        
        // Protect multi-line blocks first (code blocks, HTML blocks)
        protectedText = this.protectMultiLineBlocks(protectedText);
        
        // Patterns for protected content (including structural elements)
        const patterns = [
            // Markdown headings
            {
                regex: /^(#{1,6}\s+.*)$/gm,
                type: 'markdown_heading'
            },
            // HTML headings and title tags
            {
                regex: /^(<(h[1-6]|title)(?:\s[^>]*)?>.*?<\/\2>)$/gmi,
                type: 'html_heading'
            },
            // List items (markdown)
            {
                regex: /^(\s*)([\*\-\+]|\d+\.|[a-z]\.)\s+.*$/gm,
                type: 'list_item'
            },
            // HTML list items
            {
                regex: /^(\s*)<li(?:\s[^>]*)?>.*?<\/li>$/gmi,
                type: 'html_list_item'
            },
            // Blockquotes
            {
                regex: /^(>\s+.*)$/gm,
                type: 'blockquote'
            },
            // Horizontal rules
            {
                regex: /^(\*\*\*|---|___)\s*$/gm,
                type: 'horizontal_rule'
            },
            // Table rows
            {
                regex: /^(\|.*\|)$/gm,
                type: 'table_row'
            },
            // Single HTML tags (self-closing or opening)
            {
                regex: /^(<\/?[a-z][^>]*>)$/gmi,
                type: 'html_tag'
            },
            // URLs
            { 
                regex: /(https?:\/\/[^\s]+|www\.[^\s]+\.[^\s]+)/gi,
                type: 'url'
            },
            // Email addresses
            {
                regex: /\b[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/gi,
                type: 'email'
            },
            // Backtick code (inline)
            {
                regex: /`([^`]+)`/g,
                type: 'inline_code'
            },
            // File paths (basic pattern)
            {
                regex: /(?:[a-zA-Z]:)?(?:[\\\/][\w\s\.-]+)+/g,
                type: 'file_path'
            }
        ];
        
        // Replace each protected item with a token
        patterns.forEach(pattern => {
            protectedText = protectedText.replace(pattern.regex, (match) => {
                // Don't protect if it's already inside a protected token
                if (match.includes('__PROTECTED_') || match.includes('__STRUCTURED_') || 
                    match.includes('__MULTILINE_') || match.includes('__HTML_BLOCK_')) {
                    return match;
                }
                
                const token = `__STRUCTURED_${this.nextTokenId}__`;
                this.protectedMap.set(token, match);
                this.nextTokenId++;
                return token;
            });
        });
        
        return protectedText;
    }
    
    protectMultiLineBlocks(text) {
        let protectedText = text;
        
        // Protect code blocks (triple backticks or tildes)
        const codeBlockRegex = /(```[^`\n]*\n[\s\S]*?\n```|~~~[^~\n]*\n[\s\S]*?\n~~~)/g;
        protectedText = protectedText.replace(codeBlockRegex, (match) => {
            const token = `__MULTILINE_BLOCK_${this.nextTokenId}__`;
            this.protectedMap.set(token, match);
            this.nextTokenId++;
            return token;
        });
        
        // Protect HTML blocks (div, pre, code with content)
        const htmlBlockRegex = /(<(pre|code|div|section|article|header|footer|nav|aside|main|figure)(?:\s[^>]*)?>[\s\S]*?<\/\2>)/gi;
        protectedText = protectedText.replace(htmlBlockRegex, (match) => {
            const token = `__HTML_BLOCK_${this.nextTokenId}__`;
            this.protectedMap.set(token, match);
            this.nextTokenId++;
            return token;
        });
        
        // Protect script and style blocks
        const scriptStyleRegex = /(<(script|style)(?:\s[^>]*)?>[\s\S]*?<\/\2>)/gi;
        protectedText = protectedText.replace(scriptStyleRegex, (match) => {
            const token = `__HTML_BLOCK_${this.nextTokenId}__`;
            this.protectedMap.set(token, match);
            this.nextTokenId++;
            return token;
        });
        
        return protectedText;
    }
    
    normalizeWhitespaceWithStructure(text) {
        const lines = text.split('\n');
        const processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check if line contains protected content
            const isProtected = line.includes('__STRUCTURED_') || 
                              line.includes('__MULTILINE_BLOCK_') || 
                              line.includes('__HTML_BLOCK_');
            
            if (!isProtected) {
                // For regular lines, normalize internal whitespace
                // Replace tabs and multiple spaces with single space
                line = line.replace(/[ \t]+/g, ' ');
                
                // Normalize other Unicode whitespace characters
                line = line.replace(/[\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ');
                
                // Remove trailing spaces
                line = line.trimEnd();
            }
            
            processedLines.push(line);
        }
        
        return processedLines.join('\n');
    }
    
    processModeAWithStructure(text) {
        // Single Paragraph Mode - but preserve structural lines
        const lines = text.split('\n');
        const processedLines = [];
        let currentParagraph = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Check if line should be preserved (contains protected content)
            const shouldPreserve = 
                line.includes('__STRUCTURED_') || 
                line.includes('__MULTILINE_BLOCK_') || 
                line.includes('__HTML_BLOCK_');
            
            if (shouldPreserve || trimmed === '') {
                // Process current paragraph if exists
                if (currentParagraph.length > 0) {
                    processedLines.push(currentParagraph.join(' '));
                    currentParagraph = [];
                }
                
                if (shouldPreserve) {
                    processedLines.push(line); // Keep protected token as-is
                } else if (trimmed === '' && processedLines.length > 0) {
                    // Keep only one blank line between content
                    if (processedLines[processedLines.length - 1] !== '') {
                        processedLines.push('');
                    }
                }
            } else {
                // This is regular text that should be merged
                currentParagraph.push(trimmed);
            }
        }
        
        // Process any remaining paragraph
        if (currentParagraph.length > 0) {
            processedLines.push(currentParagraph.join(' '));
        }
        
        // Remove leading/trailing blank lines
        while (processedLines.length > 0 && processedLines[0] === '') {
            processedLines.shift();
        }
        while (processedLines.length > 0 && processedLines[processedLines.length - 1] === '') {
            processedLines.pop();
        }
        
        return processedLines.join('\n');
    }
    
    processModeBWithStructure(text) {
        // Clean Paragraph Mode - preserve all structure and paragraphs
        const lines = text.split('\n');
        const processedLines = [];
        let currentParagraph = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Check if line should break paragraphs
            const isStructural = 
                line.includes('__STRUCTURED_') || 
                line.includes('__MULTILINE_BLOCK_') || 
                line.includes('__HTML_BLOCK_');
            
            if (trimmed === '') {
                // Blank line - process current paragraph if exists
                if (currentParagraph.length > 0) {
                    processedLines.push(currentParagraph.join(' '));
                    currentParagraph = [];
                }
                // Add blank line (will be deduplicated later)
                processedLines.push('');
            } else if (isStructural) {
                // Structural element - process current paragraph first
                if (currentParagraph.length > 0) {
                    processedLines.push(currentParagraph.join(' '));
                    currentParagraph = [];
                }
                processedLines.push(line); // Keep protected token as-is
            } else {
                // Regular text - add to current paragraph
                currentParagraph.push(trimmed);
            }
        }
        
        // Process any remaining paragraph
        if (currentParagraph.length > 0) {
            processedLines.push(currentParagraph.join(' '));
        }
        
        // Clean up: remove consecutive blank lines (keep only one)
        let result = [];
        let lastWasBlank = false;
        
        for (let i = 0; i < processedLines.length; i++) {
            if (processedLines[i] === '') {
                if (!lastWasBlank) {
                    result.push('');
                }
                lastWasBlank = true;
            } else {
                result.push(processedLines[i]);
                lastWasBlank = false;
            }
        }
        
        // Remove leading/trailing blank lines
        while (result.length > 0 && result[0] === '') {
            result.shift();
        }
        while (result.length > 0 && result[result.length - 1] === '') {
            result.pop();
        }
        
        return result.join('\n');
    }
    
    processModeCWithStructure(text) {
        // Hard Normalization Mode - but still preserve protected structure
        const lines = text.split('\n');
        const processedLines = [];
        let currentContent = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Check if line should be preserved
            const shouldPreserve = 
                line.includes('__STRUCTURED_') || 
                line.includes('__MULTILINE_BLOCK_') || 
                line.includes('__HTML_BLOCK_');
            
            if (shouldPreserve) {
                // Process any accumulated content first
                if (currentContent.length > 0) {
                    processedLines.push(currentContent.join(' '));
                    currentContent = [];
                }
                // Preserve structural elements
                processedLines.push(line);
            } else if (trimmed) {
                // For Mode C: remove line breaks but keep content
                currentContent.push(trimmed);
            }
        }
        
        // Process any remaining content
        if (currentContent.length > 0) {
            processedLines.push(currentContent.join(' '));
        }
        
        // Join everything with spaces, but keep structural elements on separate lines
        let result = [];
        for (let i = 0; i < processedLines.length; i++) {
            const line = processedLines[i];
            if (line.includes('__STRUCTURED_') || 
                line.includes('__MULTILINE_BLOCK_') || 
                line.includes('__HTML_BLOCK_')) {
                result.push(line);
            } else if (line.trim()) {
                // For non-structural content, join with previous non-structural if exists
                if (result.length > 0 && 
                    !result[result.length - 1].includes('__STRUCTURED_') &&
                    !result[result.length - 1].includes('__MULTILINE_BLOCK_') &&
                    !result[result.length - 1].includes('__HTML_BLOCK_')) {
                    result[result.length - 1] = result[result.length - 1] + ' ' + line.trim();
                } else {
                    result.push(line.trim());
                }
            }
        }
        
        return result.join('\n');
    }
    
    finalCleanupWithStructure(text) {
        // Clean up spacing while preserving structure
        const lines = text.split('\n');
        const cleanedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            
            // Check if line contains protected content
            const isProtected = 
                line.includes('__STRUCTURED_') || 
                line.includes('__MULTILINE_BLOCK_') || 
                line.includes('__HTML_BLOCK_');
            
            if (!isProtected && line.trim()) {
                // Clean up regular lines
                // Remove multiple spaces (but not single spaces)
                line = line.replace(/[ ]+/g, ' ');
                // Trim
                line = line.trim();
            }
            
            if (line || isProtected) {
                // Keep non-empty lines and protected lines (even if empty-looking)
                cleanedLines.push(line);
            }
        }
        
        // Remove trailing empty lines (but keep last line if it's structural)
        while (cleanedLines.length > 0 && 
               cleanedLines[cleanedLines.length - 1] === '' &&
               !cleanedLines[cleanedLines.length - 1].includes('__STRUCTURED_') &&
               !cleanedLines[cleanedLines.length - 1].includes('__MULTILINE_BLOCK_') &&
               !cleanedLines[cleanedLines.length - 1].includes('__HTML_BLOCK_')) {
            cleanedLines.pop();
        }
        
        return cleanedLines.join('\n');
    }
    
    restoreProtectedContent(text) {
        let restored = text;
        
        // Replace tokens with original content in reverse order
        // (so we don't replace parts of other tokens)
        const tokens = Array.from(this.protectedMap.keys())
            .sort((a, b) => b.length - a.length); // Longest first
        
        tokens.forEach(token => {
            const original = this.protectedMap.get(token);
            const escapedToken = this.escapeRegExp(token);
            restored = restored.replace(new RegExp(escapedToken, 'g'), original);
        });
        
        return restored;
    }
    
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    updateOutputStats(original, processed) {
        // Word count (simple whitespace split)
        const originalWords = original.trim() ? original.trim().split(/\s+/).length : 0;
        const processedWords = processed.trim() ? processed.trim().split(/\s+/).length : 0;
        
        // Character count
        const originalChars = original.length;
        const processedChars = processed.length;
        
        // Line break count
        const originalLines = original.split('\n').length;
        const processedLines = processed.split('\n').length;
        const linesRemoved = originalLines - processedLines;
        
        // Update display
        this.outputWordCount.textContent = `Words: ${processedWords}`;
        this.outputCharCount.textContent = `Chars: ${processedChars}`;
        this.lineBreaksRemoved.textContent = `Line breaks removed: ${linesRemoved > 0 ? linesRemoved : 0}`;
    }
    
    verifyContentIntegrity(original, processed) {
        // Get all non-whitespace characters from both texts
        const originalNonSpace = original.replace(/\s+/g, '');
        const processedNonSpace = processed.replace(/\s+/g, '');
        
        // Word count verification
        const originalWords = original.trim() ? original.trim().split(/\s+/).length : 0;
        const processed
