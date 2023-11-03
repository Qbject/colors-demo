document.addEventListener('DOMContentLoaded', init);

const sheetsBridge = firebase.functions().httpsCallable("sheetsBridge");

async function init() {
    const visitResp = await sheetsBridge({ action: "visit" });

    const buttonContainer = document.querySelector(".button-container");
    buttonContainer.addEventListener("click", async event => {
        const targetButton = event.target.closest(".color-button");
        if (!targetButton) return;

        const colorIdx = targetButton.classList.contains("button-1") ? 0 : 1;
        chooseColor(visitResp.data.pairIdx, colorIdx);
    });

    const buttons = Array.from(buttonContainer.querySelectorAll(
        ":scope>.color-button"));

    for (const [i, color] of visitResp.data.colors.entries()) {
        buttons[i].textContent = color;
        buttons[i].style.borderColor = color;
    }
}

async function chooseColor(pairIdx, colorIdx) {
    const buttonContainer = document.querySelector(".button-container");
    const titleElement = document.querySelector("h1");

    buttonContainer.style.display = "none";
    titleElement.textContent = "Submitting...";

    try {
        await sheetsBridge({
            action: "choose",
            pairIdx: pairIdx,
            colorIdx
        });
    } catch (error) {
        titleElement.textContent = "Error occurred :( Check out the console" +
            " for more information";
        console.error(error);
    }

    titleElement.textContent = "Thank you for playing!";
    buttonContainer.style.display = "none";
}