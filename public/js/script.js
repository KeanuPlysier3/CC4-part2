import { WebSerial } from './serial.js';
//dom elements
let $secondScreen
let $header;
let $title;
let $main;
let $startBtn;
let $testBtn;
let $connectBtn;
let $description;
let $colorBox;
let $score;

let data;
let expectedColor = null;
let testActive = false;


//arrays
let times = [];
let colors = ["Red", "Green", "Blue"];

//globals
let startTime;
let endTime;


//new webserial instance
const serial = new WebSerial({
    usbVendorId: 6790,
    usbProductId: 21971,
    baudRate: 9600,
    autoConnect: true,
    autoReconnect: true,
});

const init = async () => {
    querySelectors();
    eventListeners();
    displaySupported();

    if (!serial.isSupported) return;
    serial.addEventListener("connect", () => {
        displayConnectionState();
    });

    serial.addEventListener("disconnect", () => {
        displayConnectionState();
    });

    serial.addEventListener('data', async (e) => {
        data = e.detail.data;
        try {
            const json = JSON.parse(data);
            console.log(json.btn)
            // Only process button presses during an active test round
            if (testActive && expectedColor && json.btn === expectedColor) {

                endTimer();
                $colorBox.style.backgroundColor = "var(--color-white)";
                round++;
                expectedColor = null;
                testActive = false;
                nextRound();
            }
            else if (testActive && expectedColor && json.btn !== expectedColor) {
                await serial.sendJSON({ device: "buzzer" });
            }
        } catch (err) {
            console.log('Received raw:', data);
        }
    });
}



const displayConnectionState = () => {
    if (serial.isConnected) {
        $secondScreen.style.display = "flex";
        $connectBtn.style.display = "none";
    } else {
        $secondScreen.style.display = "none";
        $connectBtn.style.display = "inline-block";
    }
}



const displaySupported = () => {
    if (serial.isSupported) {
        return
    }
    else {
        alert("WebSerialAPI is crucial for this project, unfortunately your current browser does not support it.")
    }
}


const querySelectors = () => {
    $header = document.querySelector('header');
    $score = document.querySelector('.score');
    $title = document.querySelector('.title');
    $main = document.querySelector('main');
    $secondScreen = document.querySelector('.second__screen');
    $description = document.querySelector('.project__descritption');
    $startBtn = document.querySelector('.start__btn');
    $testBtn = document.querySelector('.test__btn');
    $connectBtn = document.querySelector('.connect__btn');
    $colorBox = document.querySelector('.project__colors');


}
const eventListeners = () => {
    $connectBtn.addEventListener('click', (e) => { selectBoard(e); })
    $startBtn.addEventListener('click', (e) => { startTest(e); });
}
let round = 0;


const selectBoard = async () => {
    await serial.requestPort();
}

const startTest = () => {
    $score.style.display = "none";
    $startBtn.style.display = "none";
    $testBtn.style.display = "inline-block";
    round = 0;
    nextRound();
}

const nextRound = () => {
    if (round >= 3) {
        console.log("Done!", times);
        $testBtn.style.display = "none";
        $startBtn.style.display = "inline-block";
        finalScore();
        return;
    }
    $testBtn.disabled = true;
    const waitTime = randomTime();

    setTimeout(() => {
        startTimer();
        expectedColor = changeColor();
        testActive = true;
    }, waitTime);
}



const changeColor = () => {
    const index = Math.floor(Math.random() * 3);
    let color = colors[index];

    switch (color) {
        case "Red":
            $colorBox.style.backgroundColor = "var(--color-red)";
            break;

        case "Blue":
            $colorBox.style.backgroundColor = "var(--color-blue)";
            break;

        case "Green":
            $colorBox.style.backgroundColor = "var(--color-green)";
            break;
    }
    return color
};

const randomTime = () => {
    const waitTime = (Math.random() * 10000);
    console.log("waitingTime: " + waitTime);

    return waitTime;
}

const startTimer = () => {
    startTime = performance.now();
}

const endTimer = () => {
    endTime = performance.now();

    let totalTime = endTime - startTime;

    console.log("totalTime: " + totalTime);
    times.push(totalTime);
}

const finalScore = () => {
    $score.style.display = "block";
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const seconds = average / 1000;
    const time = seconds.toFixed(2)
    $score.textContent = "avg reaction speed = " + time + "s";
}

init();