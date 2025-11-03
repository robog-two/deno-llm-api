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
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question }),
    });

    if (!response.body) {
        return;
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }
        try {
            const chunk = JSON.parse(value);
            if (chunk.link) {
                const sourceElement = document.createElement('p');
                sourceElement.innerHTML = `<a href="${chunk.link}" target="_blank">${chunk.link}</a>: ${chunk.text}`;
                sourcesDiv.appendChild(sourceElement);
            }
        } catch (error) {
            responseDiv.innerHTML += value;
        }
    }
});