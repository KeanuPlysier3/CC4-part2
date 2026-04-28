import { WebSerial } from './serial.js';
//dom elements
let $secondScreen
let $header;
let $title;
let $main;
let $startBtn;

let $connectBtn;
let $description;
let $colorBox;
let $score;

let data;
let expectedColor = null;
let testActive = false;
let round = 0;


//arrays
let times = [];
let colors = ["red", "green", "blue"];

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
                await serial.sendJSON({ device: "led", led: "none" });
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

    $connectBtn = document.querySelector('.connect__btn');
    $colorBox = document.querySelector('.project__colors');


}
const eventListeners = () => {
    $connectBtn.addEventListener('click', (e) => { selectBoard(e); })
    $startBtn.addEventListener('click', (e) => { startTest(e); });
}



const selectBoard = async () => {
    await serial.requestPort();
}

const startTest = () => {
    $score.style.display = "none";
    $startBtn.style.display = "none";

    round = 0;
    nextRound();
}

const nextRound = () => {
    if (round >= 3) {
        console.log("Done!", times);

        $startBtn.style.display = "inline-block";
        testActive = false;
        finalScore();
        return;
    }

    const waitTime = randomTime();

    setTimeout(async () => {
        if (round >= 3) return; //preventing overlapping rounds started before round variables could be updated.
        startTimer();
        expectedColor = await changeColor();
        testActive = true;
    }, waitTime);
}




const changeColor = async () => {
    const index = Math.floor(Math.random() * 3);
    let color = colors[index];

    switch (color) {
        case "red":
            $colorBox.style.backgroundColor = "var(--color-red)";
            await serial.sendJSON({ device: "led", led: "red" });
            break;

        case "blue":
            $colorBox.style.backgroundColor = "var(--color-blue)";
            await serial.sendJSON({ device: "led", led: "blue" });
            break;

        case "green":
            $colorBox.style.backgroundColor = "var(--color-green)";
            await serial.sendJSON({ device: "led", led: "green" });
            break;
    }
    return color;
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