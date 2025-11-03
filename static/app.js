const form = document.getElementById('search-form');
const questionInput = document.getElementById('question');
const sourcesDiv = document.getElementById('sources');
const responseDiv = document.getElementById('response');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = questionInput.value;
    sourcesDiv.innerHTML = '';
    responseDiv.innerHTML = '';

    const response = await fetch('/api/v2/respond/withsearch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
    });

    if (!response.body) return;

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let parsingSources = true;
    let fullResponse = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            // Final render of whatever is left.
            if (buffer) fullResponse += buffer;
            responseDiv.innerHTML = marked.parse(fullResponse);
            break;
        }

        buffer += value;

        // If we are past the sources, just append everything to the response and render.
        if (!parsingSources) {
            fullResponse += buffer;
            responseDiv.innerHTML = marked.parse(fullResponse);
            buffer = '';
            continue;
        }

        let newlineIndex;
        // Process buffer line by line
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1); // Keep the remainder in the buffer

            if (line.trim() === '') continue;

            try {
                const source = JSON.parse(line);
                if (source.link) {
                    const container = document.createElement('div');
                    const link = document.createElement('a');
                    link.href = source.link;
                    link.target = '_blank';
                    link.textContent = source.link;

                    const text = document.createElement('p');
                    text.style.whiteSpace = 'pre-wrap';
                    text.textContent = source.text;

                    container.appendChild(link);
                    container.appendChild(text);
                    sourcesDiv.appendChild(container);
                } else {
                    // It's valid JSON, but not a source. Assume response starts here.
                    throw new Error("Not a source");
                }
            } catch (e) {
                // Parsing failed, so we've hit the text response.
                parsingSources = false;
                // The failed line and the rest of the buffer belong to the response.
                fullResponse += line + buffer;
                responseDiv.innerHTML = marked.parse(fullResponse);
                buffer = ''; // Buffer is now empty.
                break; // Exit the line-processing loop.
            }
        }
    }
});