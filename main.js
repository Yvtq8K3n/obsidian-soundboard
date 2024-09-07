const obsidian = require('obsidian');

class SoundboardPlugin extends obsidian.Plugin {
    onload() {
        this.audioStates = {};

        this.registerMarkdownCodeBlockProcessor('soundboard', async (source, el, ctx) => {
            const currentPath = ctx.sourcePath;

            // Parse and initialize new sounds
            const parsedSounds = this.parseSoundboard(source);
            this.audioStates[currentPath] = parsedSounds.map(sound => ({
                ...sound,
                playing: false,
                audio: this.createConfiguredAudio(sound),
            }));

            // Clear previous content
            el.innerHTML = '';
            const gridContainer = this.createSoundboardGrid(currentPath);
            el.appendChild(gridContainer);

            // Handle cleanup on unload
            ctx.addChild({
                onload: () => {},
                onunload: () => this.stopAudioByPath(currentPath),
            });
        });
    }

    parseSoundboard(source) {
        const regex = /name:\s*(.*?)\s*url:\s*(.*?)\s*(image:\s*(.*?)\s*)?(loop:\s*(true|false)\s*)?(volume:\s*(\d+)%?\s*)?(?=(name:|$))/gs;
        let match;
        const sounds = [];
        while ((match = regex.exec(source)) !== null) {
            sounds.push({
                name: match[1].trim(),
                url: match[2].trim(),
                image: match[4] ? match[4].trim() : null,
                loop: match[6] ? match[6].trim() === 'true' : false,
                volume: match[8] ? parseInt(match[8], 10) / 100 : 1,
            });
        }
        return sounds;
    }

    createConfiguredAudio(sound) {
        let audioSource;
        if (sound.url.startsWith('[[') && sound.url.endsWith(']]')) {
            const relativePath = sound.url.slice(2, -2);
            const file = this.app.vault.getAbstractFileByPath(relativePath);
            if (file) {
                audioSource = this.app.vault.getResourcePath(file);
            } else {
                console.error(`File not found: ${relativePath}`);
                return null;
            }
        } else {
            audioSource = sound.url;
        }

        console.log(`Creating audio for: ${audioSource}`); // Debugging line

        const audio = new Audio(audioSource);
        audio.loop = sound.loop;
        audio.volume = sound.volume;
        return audio;
    }

    createSoundboardGrid(sourcePath) {
        const container = document.createElement('div');
        container.className = 'soundboard-grid';

        const noteFolderPath = sourcePath.substring(0, sourcePath.lastIndexOf('/'));

        this.audioStates[sourcePath].forEach(sound => {
            const soundElement = document.createElement('div');
            soundElement.className = 'soundboard-sound';
            soundElement.dataset.playing = sound.playing ? "true" : "false";

            if (sound.image) {
                let imagePath;

                const relativePath = sound.image.slice(2, -2);
                const file = this.app.vault.getAbstractFileByPath(relativePath);

                if (file) {
                    imagePath = this.app.vault.getResourcePath(file);
                } else {
                    const fallbackPath = `${noteFolderPath}/${relativePath}`;
                    const fallbackFile = this.app.vault.getAbstractFileByPath(fallbackPath);

                    if (fallbackFile) {
                        imagePath = this.app.vault.getResourcePath(fallbackFile);
                    } else {
                        console.error(`Image not found: ${relativePath}`);
                    }
                }

                if (imagePath) {
                    const imageContainer = document.createElement('div');
                    imageContainer.className = 'soundboard-image-container';

                    const image = document.createElement('img');
                    image.src = imagePath;
                    image.alt = sound.name;
                    image.className = 'soundboard-image';

                    imageContainer.appendChild(image);
                    soundElement.appendChild(imageContainer);
                }
            }

            soundElement.addEventListener('click', () => {
                this.handleSoundClick(sound, soundElement, sourcePath);
            });

            container.appendChild(soundElement);
        });

        return container;
    }

    handleSoundClick(sound, element, sourcePath) {
        // Pause all other sounds in the current soundboard
        this.audioStates[sourcePath].forEach(s => {
            if (s !== sound && s.audio) {
                this.stopSound(s);
                const elem = document.querySelector(`[data-sound-name="${s.name}"]`);
                if (elem) elem.dataset.playing = "false";
            }
        });

        // Play or pause the selected sound
        if (element.dataset.playing === "false") {
            this.playSound(sound, element);
        } else {
            this.pauseSound(sound, element);
        }
    }

    playSound(sound, element) {
        if (sound.audio) {
            this.stopSound(sound); // Ensure any previously playing sound is stopped
            sound.audio.play().catch(error => {
                console.error(`Error playing sound: ${error}`);
            });
            element.dataset.playing = "true";
            sound.playing = true;
            if (!sound.loop) {
                sound.audio.addEventListener('ended', () => {
                    element.dataset.playing = "false";
                    sound.playing = false;
                }, {once: true});
            }
        } else {
            console.error('No audio object available for this sound.');
        }
    }

    pauseSound(sound, element) {
        if (sound.audio) {
            this.stopSound(sound); // Stop the sound and reset playback
            element.dataset.playing = "false";
            sound.playing = false;
        }
    }

    stopSound(sound) {
        if (sound.audio) {
            sound.audio.pause();
            sound.audio.currentTime = 0; // Reset to start
        }
    }

    stopAudioByPath(sourcePath) {
        if (this.audioStates[sourcePath]) {
            this.audioStates[sourcePath].forEach(sound => {
                this.stopSound(sound);
                sound.audio.src = "";
                sound.playing = false;
            });
            delete this.audioStates[sourcePath];
        }
    }
}

module.exports = SoundboardPlugin;
