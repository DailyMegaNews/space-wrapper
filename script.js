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
        const input = this.inputText.value.trim();
        if (!input) {
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
        // Step 1: Protect content
        const protectedText = this.protectContent(batch);
        
        // Step 2: Normalize whitespace
        const normalized = this.normalizeWhitespace(protectedText);
        
        // Step 3: Apply mode-specific processing
        let processed;
        switch(this.mode) {
            case 'A':
                processed = this.processModeA(normalized);
                break;
            case 'B':
                processed = this.processModeB(normalized);
                break;
            case 'C':
                processed = this.processModeC(normalized);
                break;
            default:
                processed = normalized;
        }
        
        // Step 4: Restore protected content
        const restored = this.restoreProtectedContent(processed);
        
        // Step 5: Final cleanup
        return this.finalCleanup(restored);
    }
    
    protectContent(text) {
        // Store original text for restoration
        const original = text;
        
        // Patterns for protected content
        const patterns = [
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
        
        let protectedText = text;
        
        // Replace each protected item with a token
        patterns.forEach(pattern => {
            protectedText = protectedText.replace(pattern.regex, (match) => {
                // Don't protect if it's already inside a protected token
                if (match.includes('__PROTECTED_')) {
                    return match;
                }
                
                const token = `__PROTECTED_${this.nextTokenId}__`;
                this.protectedMap.set(token, match);
                this.nextTokenId++;
                return token;
            });
        });
        
        return protectedText;
    }
    
    restoreProtectedContent(text) {
        let restored = text;
        
        // Replace tokens with original content
        this.protectedMap.forEach((original, token) => {
            restored = restored.replace(new RegExp(this.escapeRegExp(token), 'g'), original);
        });
        
        return restored;
    }
    
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    normalizeWhitespace(text) {
        // Replace all Unicode whitespace with standard space
        let normalized = text.replace(/[\t\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/g, ' ');
        
        // Replace multiple spaces with single space
        normalized = normalized.replace(/[ ]+/g, ' ');
        
        // Normalize line endings to \n
        normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        
        return normalized;
    }
    
    processModeA(text) {
        // Single Paragraph Mode
        let processed = text;
        
        // Replace all line breaks with space
        processed = processed.replace(/\n/g, ' ');
        
        // Collapse multiple spaces
        processed = processed.replace(/[ ]+/g, ' ');
        
        // Trim leading/trailing whitespace
        processed = processed.trim();
        
        return processed;
    }
    
    processModeB(text) {
        // Clean Paragraph Mode
        // Split by multiple newlines (paragraphs)
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        
        const processedParagraphs = paragraphs.map(paragraph => {
            // Replace single line breaks within paragraph with space
            let processed = paragraph.replace(/\n/g, ' ');
            
            // Collapse multiple spaces
            processed = processed.replace(/[ ]+/g, ' ');
            
            // Trim each paragraph
            return processed.trim();
        });
        
        // Join paragraphs with single blank line
        return processedParagraphs.join('\n\n');
    }
    
    processModeC(text) {
        // Hard Normalization Mode
        let processed = text;
        
        // Remove ALL line breaks
        processed = processed.replace(/\n/g, '');
        
        // Collapse ALL whitespace to single spaces
        processed = processed.replace(/\s+/g, ' ');
        
        // Trim
        processed = processed.trim();
        
        return processed;
    }
    
    finalCleanup(text) {
        // Final safety checks
        let cleaned = text;
        
        // Ensure no double spaces
        cleaned = cleaned.replace(/[ ]+/g, ' ');
        
        // Trim but preserve intentional spacing in protected content
        cleaned = cleaned.trim();
        
        return cleaned;
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
        const processedWords = processed.trim() ? processed.trim().split(/\s+/).length : 0;
        const wordMatch = originalWords === processedWords;
        
        // Character count verification (non-whitespace)
        const charMatch = originalNonSpace.length === processedNonSpace.length;
        
        // Content verification - check if all original non-space chars exist in processed text
        let contentVerified = true;
        if (charMatch) {
            // For efficiency, compare sorted characters or use Set comparison
            const originalSet = new Set(originalNonSpace);
            const processedSet = new Set(processedNonSpace);
            
            // Check if all characters from original exist in processed
            for (let char of originalSet) {
                if (!processedSet.has(char)) {
                    contentVerified = false;
                    break;
                }
            }
        } else {
            contentVerified = false;
        }
        
        // Update verification indicators
        this.updateVerificationIndicator(this.wordMatch, wordMatch, 'Word count mismatch');
        this.updateVerificationIndicator(this.charMatch, charMatch, 'Character count mismatch');
        this.updateVerificationIndicator(this.contentMatch, contentVerified, 'Content alteration detected');
        
        // Show warning if any mismatch
        if (!wordMatch || !charMatch || !contentVerified) {
            this.showWarning('Content verification failed. Review output carefully.');
        }
    }
    
    updateVerificationIndicator(element, isMatch, warningText) {
        if (isMatch) {
            element.textContent = '✓';
            element.className = 'verification-value match';
        } else {
            element.textContent = '✗';
            element.className = 'verification-value mismatch';
            element.title = warningText;
        }
    }
    
    showWarning(message) {
        this.warningText.textContent = message;
        this.warningBanner.style.display = 'flex';
    }
    
    async copyToClipboard() {
        const text = this.outputText.textContent;
        
        try {
            await navigator.clipboard.writeText(text);
            
            // Visual feedback
            const originalText = this.copyBtn.innerHTML;
            this.copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
            this.copyBtn.style.background = 'var(--success-color)';
            
            setTimeout(() => {
                this.copyBtn.innerHTML = originalText;
                this.copyBtn.style.background = '';
            }, 2000);
            
        } catch (err) {
            console.error('Failed to copy: ', err);
            this.showWarning('Failed to copy to clipboard');
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SpaceWrapper();
});
