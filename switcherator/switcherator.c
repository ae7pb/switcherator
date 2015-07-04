#ifndef __AVR_ATmega328__
#define __AVR_ATmega328__
#endif
#ifndef F_CPU
#define F_CPU 16000000
#endif
// TODO: deal with pulse width sonar thingie

// If you want the hex smaller
// Basically if you aren't going to use the human readble functions (switch display, etc) then this will save you code space
//#define SMALLER = 1


#include "switcherator.h"

// globals and such

// First time we are turned on and we have the wrong time
static char panicMyClockIsNotSet = 1;


// clock related
static unsigned int ticks = 0; // ticks for the clock
static unsigned int tenthTicks = 0;
static unsigned int globalYear, globalMonth, globalDay, globalHour, globalMinute, globalSecond, dow;
// dow - Sunday = 0
static unsigned long weeklySeconds = 0;
// This is 1 on daylight savings day so I don't do it twice
static char wasDaylightSavings = 0;
static unsigned int daylightSavings[2][2]; // [0][0] = spring month, [0][1] = spring day, etc...

// flags
static char newSecond = 0;
static char newMinute = 0;
static char switchChanged = 0;
static char tenthFlag = 0; // 10th of a second(ish) has passed
static char failCondition = 0;
static char failTimer = 0;
#define INDICATOR_PORT PORTD
#define INDICATOR_PIN (1 << PIND2)
#define INDICATOR_DDR DDRD

// When the switch will turn off (weekly seconds))
static unsigned long switchStatus[NUM_SWITCHES];
// Coded information for the switches
// value of 255 (default) means nothing programmed
// value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
// 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
// pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
// 200 = PWM, 201 = PWM rotating hue. PWM always uses PORTD3,PORTD5,PORTD6 for RGB
// 202 = Color changing PWM
// future - 202 - PWM with other ports. Can't on 328p since radio overlaps pwm pins
static char switchStuff[NUM_SWITCHES];
// Switch PWM
// K I wish I did the switch stuff different.  Oh well.  Easier to add another array
// Switch PWM - which color change that the switch will turn on. So different switches
// mean different colors.
static char switchPWM[NUM_SWITCHES];

// So the hue overrides the pwm so I want this to stop the hue when pwm is in use like an input
static char PWMInUse;


// strings
static char radioReceiveBuffer[30];
static char tempIntString[] = "00";
static char tempLongString[] = "0000";
static char tempHugeString[] = "000000";
static char statusMsg[33];

// HardwarePWM
static char runHue = 0;
static char runColorChanges = 0;
// PD3, PD5, PD6 or red,green,blue
static char colorChanges[NUM_COLOR_CHANGES][3];
static char colorIsChangable[NUM_COLOR_CHANGES];
static char pwmIsSet = 0; // if we have pwm set up
static int pwmSwitchNumber = 0;

// PWM Override for immediate change
static unsigned long immediateChange = 0;
static char pwmOldValues[] = {0, 0, 0};
static char pwmChangeValues[] = {0, 0, 0};

// if an input is a pwm we may need to make sure the right input is on
static int switchPWMOverride;

// rotating hue
static unsigned int currentHue;
static unsigned int hueSpeed;
static unsigned int hueCount;
static unsigned int hueBright;
static unsigned char littleCount;
static unsigned int colorChangeSpeed; // how many 1/10 seconds in each color change
static unsigned int colorChangeCount;
static unsigned char currentColor;
#define Red OCR2B
#define Green OCR0B
#define Blue OCR0A
static unsigned int red = 0;
static unsigned int green = 0;
static unsigned int blue = 0;
static unsigned char pwmdir = 0;


// programs and such kept in EEPROM
// 1 byte day of week mask or 0 for everyday
// 2 byte start time (seconds in day), 2 bytes duration (seconds), 1 byte additional program
// If more than 4 switches are desired it will roll over to an additional program
// DssddSSSSP
// 0123456789   
static unsigned char weeklyProgram[MAX_PROGRAM][10];

// input information
// Pp - value of 255 (default) means nothing programmed
// value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
// 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
// pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
// pLHsDDPw Pp int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
// dur in seconds, poll time in secs or  0 for continuous. w = which rgb (mask);)
static unsigned char inputs[NUM_INPUTS][8];

// Times that the PROGRAMS will react to a switch (eg dusk to dawn)
// [0]=start,[1]=stop,[2]=days
static unsigned long timeLimits[NUM_LIMITS][3];


// adjust the timer so it can be accurate
static long tweakTimer = TIMER_TOTAL;
static int adjustment = 0;


// We need to be able to send feedback with switches
static char inputMessage[30];
static char inputMessageAttempts = 0;
static long inputMessageGathered[NUM_INPUTS];
static int inputMessageTiming = 0;


// send receive addresses
static uint64_t rx_addr_p0, rx_addr_p1, rx_addr_p2, rx_addr_p3, rx_addr_p4, rx_addr_p5, tx_addr;
static uint64_t inputAddr;

int main(void) {
    // we're using the watchdog to reset so lets avoid a loop
    MCUSR = 0;
    wdt_disable();
    failCondition = 1;
    radioReceiveBuffer[0] = 0;
    int x = 0;
    inputMessage[0] = 0;
    hueSpeed = 16;
    colorChangeSpeed = 10;
    tweakTimer = TIMER_TOTAL;
    switchPWMOverride = 99;
    PWMInUse = 0;


    INDICATOR_DDR |= INDICATOR_PIN;
    for (x = 0; x < 4; x++) {
        INDICATOR_PORT |= INDICATOR_PIN;
        _delay_ms(50);
        INDICATOR_PORT &= ~(INDICATOR_PIN);
        _delay_ms(100);
    }
    INDICATOR_PORT |= INDICATOR_PIN;


    // set color changes to blank
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        colorChanges[x][0] = 0;
        colorChanges[x][1] = 1;
        colorChanges[x][2] = 0;
        colorIsChangable[x] = 1;
    }

    // just initializing memory
    globalYear = globalMonth = globalDay = globalHour = globalMinute = globalSecond = dow = 0;
    for (x = 0; x < NUM_SWITCHES; x++) {
        switchStatus[x] = 0;
        switchStuff[x] = 255;
    }
    for (x = 0; x < NUM_INPUTS; x++) {
        inputs[x][0] = 255;
        inputMessageGathered[x] = 0;
    }
    sei();

    int y;
    // initialize programs
    for (x = 0; x < MAX_PROGRAM; x++) {
        for (y = 0; y < 10; y++) {
            weeklyProgram[x][y] = 255;
        }
    }



    clockInit();
    radioInit();
    // make sure general init is after radioinit
    generalInit();
    startClock();



    // radio related
    int payloadLength = 0;



    while (1) {
        // what to run every second
        if (newSecond == 1) {
            newSecond = 0;
            timerCheck();
            inputCheck();
            // every 5 seconds we try to send a response about a switch
            if (globalSecond % 5 == 0 && strlen(inputMessage) > 0) {
                inputMessageAttempts++;
                if (inputMessageAttempts >= 20) {
                    inputMessageAttempts = 0;
                    inputMessage[0] = 0;
                } else {
                    sendInputMessage();
                }
            }
            if ((failCondition & 2) == 2 || (failCondition & 4) == 4)
                radioInit2();
        }
        // runs only if a switch changed
        if (switchChanged == 1) {
            switchChanged = 0;
            switchOnOff();
        }
        if (runHue == 1 && immediateChange == 0) {
            runHueFunction();
        }

        // override for immediate change in color
        if (immediateChange > 0 && weeklySeconds > immediateChange) {
            clearImmediateChange();
        }

        if (tenthFlag == 1) {
            tenthFlag = 0;
            inputTenthCheck();
            if (failCondition > 0) {
                flashFail();
            }
            if (runColorChanges == 1 && immediateChange == 0) {
                runColorFunction();
            }
        }
        if (newMinute == 1) {
            newMinute = 0;
            if (panicMyClockIsNotSet == 1) {
                generalStatus("gsq");
            }
            radioTest();
        }
        // check for radio instructions
        payloadLength = dynReceive(radioReceiveBuffer);
        if (payloadLength > 1) {
            // wait so the receiver won't miss our response
            //            _delay_ms(90);
            checkCommand(radioReceiveBuffer);

            // clear the buffer
            for (x = 0; x < 30; x++) {
                radioReceiveBuffer[x] = 0;
            }
        }
    }
}

/****************************************************************
 *
 *              All Things Command and Interface Related
 *
 ****************************************************************/

void checkCommand(char * commandReceived) {
    if (commandReceived[0] > 0x60)
        commandReceived[0] -= 0x20;
    if (commandReceived[1] > 0x60)
        commandReceived[1] -= 0x20;
    int switchme = commandReceived[0];
    switchme <<= 8;
    switchme |= commandReceived[1];
    switch (switchme) {
        case 0x5449: //TI
            setClock(commandReceived);
            break;
        case 0x4453: //DS
            setDaylightSavings(commandReceived);
            break;
        case 0x544C: //TL
            setTimeLimits(commandReceived);
            break;
        case 0x4E53: //NS
            setNewSwitch(commandReceived);
            break;
        case 0x5343: //SC
            switchClear(commandReceived);
            break;
        case 0x5344: //SD
            switchDisplay(commandReceived);
            break;
        case 0x5053: //PS
            pwmSetup(commandReceived);
            break;
        case 0x4348: //CH
            setColorChangeSpeed(commandReceived);
            break;
        case 0x4853: //HS
            setHueSpeed(commandReceived);
            break;
        case 0x4E50: //NP
            newProgram(commandReceived);
            break;
        case 0x4350: //CP
            clearProgram(commandReceived);
            break;
        case 0x5041: //PA
            programAddSwitch(commandReceived);
            break;
        case 0x5044: //PD
            programSetDays(commandReceived);
            break;
        case 0x5054: //PT
            programSetTime(commandReceived);
            break;
        case 0x5049: //PI
            programDisplay(commandReceived);
            break;
        case 0x5045: //PE
            programEdit(commandReceived);
            break;
        case 0x5353: //SS
            startSwitch(commandReceived);
            break;
        case 0x5350: //SP
            startProgram(commandReceived);
            break;
        case 0x5341: //SA
            saveToEEPROM();
            break;
        case 0x434C: //CL
            clearToEEPROM();
            break;
        case 0x5244: //RD
            radioDisplayAddress(commandReceived);
            break;
        case 0x5243: //RC
            radioChangeAddress(commandReceived);
            break;
        case 0x4149: //AI
            setAnalogInput(commandReceived);
            break;
        case 0x4449: //DI
            setDigitalInput(commandReceived);
            break;
        case 0x4349: //CI
            clearInput(commandReceived);
            break;
        case 0x4354: //CT
            clockTweak(commandReceived);
            break;
        case 0x5057: //PW
            pwmSummary();
            break;
        case 0x4753: //GS
            generalStatus(commandReceived);
            break;
        case 0x4343: //CC
            colorChangeSet(commandReceived);
            break;
        case 0x4749: //GI
            generalInformation();
            break;
        case 0x5050: //PP
            programsProgrammed();
            break;
        case 0x5357: //SW
            switchesProgrammed();
            break;
        case 0x4950: //IP
            inputsProgrammed();
            break;
        case 0x534F: //SO
            switchesOn();
            break;
        case 0x4943: //IC
            setImmediateChange(commandReceived);
            break;
        case 0x4954: //IT
            setInputMessageTiming(commandReceived);
            break;
        case 0x5744: //WD
            setPWMDir(commandReceived);
            break;
        case 0x5245: //RE
            resetMe();
            break;
        case 0x4D57: //MW
            memoryWrite(commandReceived);
            break;
        case 0x4D52: //MR
            memoryRead(commandReceived);
            break;
        default:
        case 0x4455: //DU
            memoryDump();
            break;
    }
}

void fail(int failCode) {
    statusMsg[0] = 0;
    strcat(statusMsg, "fail:");
    returnHex(failCode, tempLongString);
    strcat(statusMsg, tempLongString);
    sendMessage(statusMsg);
}

void ok(void) {
    sendMessage("ok");
}

/* Little helpers to turn the command received in to an int or a long
 * 
 */
int getInt(char * commandReceived, int first, int chars) {
    tempHugeString[0] = 0;
    strncat(tempHugeString, &commandReceived[first], chars);
    int output;
    output = atoi(tempHugeString);
    return output;
}

long getLong(char * commandReceived, int first, int chars) {
    tempHugeString[0] = 0;
    strncat(tempHugeString, &commandReceived[first], chars);
    long output;
    output = atol(tempHugeString);
    return output;
}

int getHexInt(char * commandReceived, int first, int chars) {
    tempHugeString[0] = 0;
    strncat(tempHugeString, &commandReceived[first], chars);
    long temp;
    int output;
    temp = strtol(tempHugeString, 0, 16);
    output = temp;
    return output;
}


// Helper function to get the switch number from char 3 and 4 of an array

int getSwitchNumber(char * commandReceived) {
    int switchNumber = 0;
    // get switch number
    tempIntString[0] = commandReceived[3];
    tempIntString[1] = commandReceived[4];
    switchNumber = atoi(tempIntString);
    return switchNumber;
}


/****************************************************************
 *
 *              All Things Switch Related
 *
 ****************************************************************/
// Setup a new switch
// NS:S#PpD
// 01234567

void setNewSwitch(char * commandReceived) {
    int switchNumber = 0;
    char port = 0;
    unsigned char pinMultiplied = 0;
    unsigned char pinSubtractee = 0;
    volatile unsigned char *realPort = 0;
    volatile unsigned char *realDDR = 0;
    char pin = 0;
    char originalPin = 0;
    char direction = 0;
    tempIntString[0] = '0';
    tempIntString[1] = commandReceived[6];
    pin = atoi(tempIntString);
    originalPin = pin;
    tempIntString[1] = commandReceived[7];
    direction = atoi(tempIntString);
    port = commandReceived[5];
    switchNumber = getSwitchNumber(commandReceived);
    // make sure it is off before doing a new one.
    clearTheSwitch(switchNumber);
    // get the pin string ready for below
    if (port == 'B' || port == 'b') {
        realPort = &PORTB;
        realDDR = &DDRB;
        pinSubtractee = 16;
#ifdef PORTA
    } else if (port == 'A' || port == 'a') {
        realPort = &PORTA;
        realDDR = &DDRA;
        pinSubtractee = 0;
#endif
#ifdef PORTC
    } else if (port == 'C' || port == 'c') {
        realPort = &PORTC;
        realDDR = &DDRC;
        pinSubtractee = 32;
#endif
#ifdef PORTD
    } else if (port == 'D' || port == 'd') {
        realPort = &PORTD;
        realDDR = &DDRD;
        pinSubtractee = 48;
#endif
#ifdef PORTE
    } else if (port == 'E' || port == 'e') {
        realPort = &PORTE;
        realDDR = &DDRE;
        pinSubtractee = 64;
#endif
#ifdef PORTF
    } else if (port == 'F' || port == 'f') {
        realPort = &PORTF;
        realDDR = &DDRF;
        pinSubtractee = 80;
#endif
#ifdef PORTG
    } else if (port == 'G' || port == 'g') {
        realPort = &PORTG;
        realDDR = &DDRG;
        pinSubtractee = 96;
#endif
#ifdef PORTH
    } else if (port == 'H' || port == 'h') {
        realPort = &PORTH;
        realDDR = &DDRH;
        pinSubtractee = 112;
#endif
#ifdef PORTI
    } else if (port == 'I' || port == 'i') {
        realPort = &PORTI;
        realDDR = &DDRI;
        pinSubtractee = 128;
#endif

    }


    if (realPort == 0) {
        fail(2);
    } else if ((switchNumber >= NUM_SWITCHES) ||
            ((switchNumber == 0) && (commandReceived[3] != '0') && (commandReceived[4] != 0))) {
        fail(1);
    } else if ((pin > 7) || ((pin == 0) && (commandReceived[6] != '0'))) {
        fail(4);
    } else {
        // set DDR out
        *realDDR |= (1 << originalPin);
        // double the pin and add 1 if it is high
        pinMultiplied = pin * 2;
        // turn switch off
        pin = pinMultiplied + pinSubtractee;
        switchStuff[switchNumber] = pin;

        if (direction == 0) {
            // 0 = low is on  1 = high is on
            *realPort |= (1 << originalPin);
        } else {
            *realPort &= ~(1 << originalPin);
            switchStuff[switchNumber]++;
        }
        ok();
    }
}

// get rid of a switch and turn it off
// SC:S#
// 01234

void switchClear(char * commandReceived) {
    int switchNumber = 0;
    // get switch number
    switchNumber = getSwitchNumber(commandReceived);
    clearTheSwitch(switchNumber);
    ok();
}

// actual turning switch off (called with new switch as well)

void clearTheSwitch(int switchNumber) {
    char port[] = {0};
    char pin[] = {0};
    char direction[] = {0};
    volatile unsigned char *thisPort = 0;
    volatile unsigned char *thisDDR = 0;
    int realPin = 0;
    // Figure out if it is pwm
    if (switchStuff[switchNumber] >= 200 && switchStuff[switchNumber] <= 220) {
        // if it is something else
        pwmClear(switchNumber);
        switchStuff[switchNumber] = 255;
        return;
    }
    getPort(switchNumber, port, pin, direction);
    if (port[0] == 'B') {
        thisPort = &PORTB;
        thisDDR = &DDRB;
#ifdef PORTA
    } else if (port[0] == 'A') {
        thisPort = &PORTA;
        thisDDR = &DDRA;
#endif        
#ifdef PORTC
    } else if (port[0] == 'C') {
        thisPort = &PORTC;
        thisDDR = &DDRC;
#endif        
#ifdef PORTD
    } else if (port[0] == 'D') {
        thisPort = &PORTD;
        thisDDR = &DDRD;
#endif        
#ifdef PORTE
    } else if (port[0] == 'E') {
        thisPort = &PORTE;
        thisDDR = &DDRE;
#endif        
#ifdef PORTF
    } else if (port[0] == 'F') {
        thisPort = &PORTF;
        thisDDR = &DDRF;
#endif        
#ifdef PORTG
    } else if (port[0] == 'G') {
        thisPort = &PORTG;
        thisDDR = &DDRG;
#endif        
#ifdef PORTH
    } else if (port[0] == 'H') {
        thisPort = &PORTH;
        thisDDR = &DDRH;
#endif        
#ifdef PORTI
    } else if (port[0] == 'I') {
        thisPort = &PORTI;
        thisDDR = &DDRI;
#endif        
    }
    realPin = pin[0];
    *thisDDR &= ~(1 << realPin);
    *thisPort &= ~(1 << realPin);
    switchStuff[switchNumber] = 255;
}

// show a summary of the switches

void switchDisplay(char * commandReceived) {
#ifndef SMALLER
    char port[] = {0};
    char pin[] = {0};
    char direction[] = {0};
    int switchNumber = 0;
    int realPin = 0;
    char statusMsg[32];
    switchNumber = getSwitchNumber(commandReceived);
    statusMsg[0] = 0;
    // see if this is a pwm switch
    if (switchStuff[switchNumber] >= 200 && switchStuff[switchNumber] <= 220) {
        // yes pwm
        if (switchStuff[switchNumber] == 202) {
            strcat(statusMsg, "CoC");
        } else if (switchStuff[switchNumber] == 212) {
            strcat(statusMsg, "Brt");
        } else if (switchStuff[switchNumber] == 200) {
            strcat(statusMsg, "Fix");
        } else {
            strcat(statusMsg, "Hue");
        }
    } else {
        getPort(switchNumber, port, pin, direction);
        tempIntString[0] = port[0];
        tempIntString[1] = 0;
        strcat(statusMsg, tempIntString);
        realPin = pin[0];
        itoa(realPin, tempIntString, 10);
        strcat(statusMsg, tempIntString);
        if (direction[0] == 0) {
            strcat(statusMsg, "L");
        } else {
            strcat(statusMsg, "H");
        }
    }
    sendMessage(statusMsg);
#endif
}

// takes in a switch number and time and turns on the switch
// SS S#Durat.
// 01234567890

void startSwitch(char * commandReceived) {
    unsigned long duration;
    int switchNumber = 0;
    // get switch number
    switchNumber = getSwitchNumber(commandReceived);
    if ((switchNumber >= NUM_SWITCHES) || (switchStuff[switchNumber] == 255)) {
        fail(1);
        return;
    }
    // get duration.
    duration = getLong(commandReceived, 5, 6);
    if (duration == 0) {
        fail(5);
        return;
    }
    // only update the time if it is longer than what the switch is already turned on to
    if ((weeklySeconds + duration) > switchStatus[switchNumber])
        switchStatus[switchNumber] = (weeklySeconds + duration);

    // see if it is PWM - also won't override immediate change
    if (switchStuff[switchNumber] >= 200 && switchStuff[switchNumber] <= 220
            && immediateChange == 0) {
        // k it is PWM.  See if it is hue
        if (switchStuff[switchNumber] == 200) {
            int temp = switchPWM[switchNumber];
            // even number so values, not hue
            red = colorChanges[temp][0];
            green = colorChanges[temp][1];
            blue = colorChanges[temp][2];
            Red = red;
            Green = green;
            Blue = blue;
            PWMInUse = 1;
        } else if (switchStuff[switchNumber] == 202) {
            runColorChanges = 1;
            PWMInUse = 0;
        } else {
            runHue = 1;
            hueBright = switchPWM[switchNumber];
        }

    } else {

        // get the port and turn it on
        char port[1];
        char pin[1];
        int realPin = 0;
        char direction[1];
        volatile unsigned char *thisPort = 0;
        getPort(switchNumber, port, pin, direction);
        // yeah pointers and casts and whatevers. this fixes it
        realPin = pin[0];
        if (port[0] == 'B')
            thisPort = &PORTB;
#ifdef PORTA
        else if (port[0] == 'A')
            thisPort = &PORTA;
#endif
#ifdef PORTC
        else if (port[0] == 'C')
            thisPort = &PORTC;
#endif
#ifdef PORTD
        else if (port[0] == 'D')
            thisPort = &PORTD;
#endif
#ifdef PORTE
        else if (port[0] == 'E')
            thisPort = &PORTE;
#endif
#ifdef PORTF
        else if (port[0] == 'F')
            thisPort = &PORTF;
#endif
#ifdef PORTG
        else if (port[0] == 'G')
            thisPort = &PORTG;
#endif
#ifdef PORTH
        else if (port[0] == 'H')
            thisPort = &PORTH;
#endif
#ifdef PORTI
        else if (port[0] == 'I')
            thisPort = &PORTI;
#endif

        // turn it on based on what direction
        if (direction[0] == 0) {
            *thisPort &= ~(1 << realPin);
        } else {
            *thisPort |= (1 << realPin);
        }
    }
    ok();
}
// Takes in a switch number and returns the port (as a letter), pin, direction 0,1, and actual PORT address

void getPort(int switchNumber, char * port, char * pin, char * direction) {
    char switchInfo = switchStuff[switchNumber];
    if ((switchInfo >= 16 && switchInfo < 32)) {
        port[0] = 'B';
        switchInfo -= 16;
    } else if (switchInfo < 16) {
        port[0] = 'A';
        switchInfo -= 0;
    } else if (switchInfo < 48) {
        port[0] = 'C';
        switchInfo -= 32;
    } else if (switchInfo < 64) {
        port[0] = 'D';
        switchInfo -= 48;
    } else if (switchInfo < 80) {
        port[0] = 'E';
        switchInfo -= 64;
    } else if (switchInfo < 96) {
        port[0] = 'F';
        switchInfo -= 80;
    } else if (switchInfo < 112) {
        port[0] = 'G';
        switchInfo -= 96;
    } else if (switchInfo < 128) {
        port[0] = 'H';
        switchInfo -= 112;
    } else if (switchInfo < 144) {
        port[0] = 'I';
        switchInfo -= 128;
    } else {
        port[0] = '?';
        pin[0] = 0;
        direction[0] = 0;
        return;
    }
    pin[0] = switchInfo / 2;
    direction[0] = switchInfo % 2;
}


/****************************************************************
 *
 *              All Things PWM Related
 *
 ****************************************************************/

// PWM setup.  This is initially  geared for the 328p but the framework
// exists for other chips
// PS:P#S#H - p# is color change num or hue brightness, s# is switch, H = hue/colorchange/solid color
// 012345678

void pwmSetup(char * commandReceived) {
    int x = 0;
    int whichColorChange;
    // these port/pins are the PWM spots.
    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStuff[x] == 70 || switchStuff[x] == 71 || switchStuff[x] == 74 ||
                switchStuff[x] == 75 || switchStuff[x] == 76 || switchStuff[x] == 77) {
            fail(6);
            return;
        }
    }
    whichColorChange = getInt(commandReceived, 3, 2);
    int switchNumber;
    // get switch number
    switchNumber = getInt(commandReceived, 5, 2);
    clearTheSwitch(switchNumber);
    // set up a hue pwm
    if (commandReceived[7] == 'H' || commandReceived[7] == 'h' || commandReceived[7] == '1') {
        switchStuff[switchNumber] = 201;
        if(whichColorChange > 16)
            whichColorChange = 16;
        if(whichColorChange == 0)
            whichColorChange = 16;
        switchPWM[switchNumber] = whichColorChange;
    } else if (commandReceived[7] == 'C' || commandReceived[7] == 'c') {
        switchStuff[switchNumber] = 202;
    } else {
        switchStuff[switchNumber] = 200;
        switchPWM[switchNumber] = whichColorChange;
    }
    DDRD |= (1 << PIND3) | (1 << PIND5) | (1 << PIND6);
    // make sure initial values are 0
    //Red = 0;
    //Green = 0;
    //Blue = 0;
    // F_CPU/64 timers
    TCCR0B = (1 << CS01) | (1 << CS00);

    TCCR2B = (1 << CS22); // F_CPU/64
    // default pwm dir to out
    setPWMDir("xxxH");

    pwmIsSet = 1;
    pwmSwitchNumber = switchNumber;
    // pwm to output
}

// Turn off the PWM - called by clearing the switch

void pwmClear(int switchNumber) {
    TCCR0A = 0;
    TCCR0B = 0;
    TCCR2A = 0;
    TCCR2B = 0;
    Red = 0;
    Green = 0;
    Blue = 0;
    DDRD &= ~((1 << PIND3)&(1 << PIND5)&(1 << PIND6));
    runHue = 0;
    runColorChanges = 0;
    pwmIsSet = 0;
    PWMInUse = 0;
}

// Sets up the direction of the pwm
// WD:d = d=1 high
// 0123

void setPWMDir(char * commandReceived) {
    // Set output phase correct whatevers
    // set it to inverted if the direction is 0
    if (commandReceived[3] == '0' || commandReceived[3] == 'l' ||
            commandReceived[3] == 'L') {
        pwmdir = 0;
        TCCR0A = (1 << COM0A0) | (1 << COM0A1) | (1 << COM0B0) | (1 << COM0B1) | (1 << WGM00);
        TCCR2A = (1 << COM2B0) | (1 << COM2B1) | (1 << WGM20);
    } else if (commandReceived[3] == 'x') {
        statusMsg[0] = 0;
        if (pwmdir == 1)
            strcat(statusMsg, "Hi");
        else
            strcat(statusMsg, "Low");
        sendMessage(statusMsg);
    } else {
        pwmdir = 1;
        TCCR0A = (1 << COM0A1) | (1 << COM0B1) | (1 << WGM00);
        TCCR2A = (1 << COM2B1) | (1 << WGM20);
    }
    ok();
}




// This just sets up the times for the PWM hues
// CH:TTTTT 
// 0123456789

void setColorChangeSpeed(char * commandReceived) {
    // right now we just have 1 pwm but I could add more
    int programNumber = 0;
    programNumber = getHexInt(commandReceived, 3, 4);
    if (programNumber > 0)
        colorChangeSpeed = programNumber;
    else {
        statusMsg[0] = 0;
        itoa(colorChangeSpeed, statusMsg, 10);
        sendMessage(statusMsg);
    }
    ok();
}

// Changes the hue speed
// HS:xx

void setHueSpeed(char * commandReceived) {
    int programNumber = getHexInt(commandReceived,3,2);
    if (programNumber > 0)
        hueSpeed = programNumber;
    else {
        statusMsg[0] = 0;
        itoa(hueSpeed, statusMsg, 10);
        sendMessage(statusMsg);
    }
    ok();
}


// set up the values for a solid pwm
// PV:P#,vvv,vvv,vvv

// add a color to the color change
// CC:##,vvv,vvv,vvv,p - p = pwm only
// CC:##rrggbbp
// 0123456789012345678

void colorChangeSet(char * commandReceived) {
    int programNumber = getSwitchNumber(commandReceived);
    if (programNumber >= NUM_COLOR_CHANGES) {
        fail(7);
        return;
    }
    colorChanges[programNumber][0] = getHexInt(commandReceived, 5, 2);
    colorChanges[programNumber][1] = getHexInt(commandReceived, 7, 2);
    colorChanges[programNumber][2] = getHexInt(commandReceived, 9, 2);
    if (commandReceived[11] == '1') {
        colorIsChangable[programNumber] = 0;
    } else {
        colorIsChangable[programNumber] = 1;
    }
    ok();
}

// show the pwm values & color change values

void pwmSummary(void) {
#ifndef SMALLER
    statusMsg[0] = 0;
    int x;
    strcat(statusMsg, "Dir ");
    returnInt(pwmdir, tempLongString);
    strcat(statusMsg, tempLongString);
    sendMessage(statusMsg);
    statusMsg[0] = 0;
    strcat(statusMsg, "ColCh:");
    int y = 0;
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        if (x > 0)
            strcat(statusMsg, ",");
        strcat(statusMsg, "0x");
        if (colorChanges[x][0] == 0 && colorChanges[x][1] == 1 &&
                colorChanges[x][2] == 0)
            strcat(statusMsg, "--");
        else {
            for (y = 0; y < 3; y++) {
                if (y > 0)
                    strcat(statusMsg, ",");
                returnHexWithout(colorChanges[x][y], tempLongString);
                strcat(statusMsg, tempLongString);
            }
        }
        if (colorIsChangable[x] == 1) {
            strcat(statusMsg, "Y");
        } else {
            strcat(statusMsg, "N");
        }
        if (strlen(statusMsg) > 20) {
            sendMessage(statusMsg);
            statusMsg[6] = 0;
        }
    }
    if (strlen(statusMsg) > 6)
        sendMessage(statusMsg);
    statusMsg[0] = 0;
    for (x = 0; x < NUM_SWITCHES; x++) {
        if ((switchStuff[x] >= 200) && (switchStuff[x] <= 220)) {
            strcat(statusMsg, "PWM ");
            if (switchStuff[x] == 200) {
                strcat(statusMsg, "static ");
                returnInt(switchPWM[x], tempLongString);
                strcat(statusMsg, tempLongString);
            } else if (switchStuff[x] == 202) {
                strcat(statusMsg, "ColCh");
            } else {
                strcat(statusMsg, "hue");
            }
            strcat(statusMsg, " on sw# ");
            returnInt(x, tempLongString);
            strcat(statusMsg, tempLongString);
            sendMessage(statusMsg);
            statusMsg[0] = 0;
        }
    }
#endif
}
// HardwarePWM
//static char runHue = 0;
// PD3, PD5, PD6 or red,green,blue


// Run color function
// goes through the colors and switches them.

void runColorFunction(void) {
    // delay
    colorChangeCount++;
    if (colorChangeCount < colorChangeSpeed)
        return;
    int colorTimeouter = 0;
    // do not override a pwm like an input
    if(PWMInUse > 0) {
        return;
    }
    while (1) {
        colorChangeCount = 0;
        currentColor++;
        colorTimeouter++;
        if (currentColor == NUM_COLOR_CHANGES)
            currentColor = 0;
        if (colorChanges[currentColor][0] == 0 &&
                colorChanges[currentColor][1] == 1 &&
                colorChanges[currentColor][2] == 0) {
            // this one is blank.
            if (currentColor == 0)
                return;
        } else if (colorIsChangable[currentColor] == 1)
            break;
        if (colorTimeouter >= NUM_COLOR_CHANGES)
            return;
    }
    red = colorChanges[currentColor][0];
    green = colorChanges[currentColor][1];
    blue = colorChanges[currentColor][2];
    Red = red;
    Green = green;
    Blue = blue;
}
// rotating hue
//static int currentHue = 0;
//static int hueSpeed = 0;
//static char hueCount = 0;
//#define Red OCR2B
//#define Green OCR0B
//#define Blue OCR0A

// go through and rotate the hue based color rotation
// static int currentHue = 0;
// static char hueSpeed = 0;
// static char hueCount = 0;

void runHueFunction(void) {
    // extra fixed delay
    littleCount++;
    if (littleCount != 2)
        return;
    littleCount = 0;
    hueCount++;
    // only run if the count is higher than the "speed"
    if (hueCount < hueSpeed) {
        return;
    }
    // do not override a pwm like an input
    if(PWMInUse > 0) {
        return;
    }
    
    hueCount = 0;
    if (currentHue < 0x00ff) {
        red = 255;
        green = currentHue;
        blue = 0;
    } else if (currentHue < 0x01ff) {
        red = 255 - (currentHue - 0xff);
        green = 255;
        blue = 0;
    } else if (currentHue < 0x02ff) {
        red = 0;
        green = 255;
        blue = (currentHue - 0x1ff);
    } else if (currentHue < 0x03ff) {
        red = 0;
        green = 255 - (currentHue - 0x2ff);
        blue = 255;
    } else if (currentHue < 0x04ff) {
        red = (currentHue - 0x3ff);
        green = 0;
        blue = 255;
    } else if (currentHue < 0x05ff) {
        red = 255;
        green = 0;
        blue = 255 - (currentHue - 0x4ff);
    } else {
        red = 255;
        green = 0;
        blue = 0;
        currentHue = 0;
    }
    red = (red * hueBright) / 16;
    green = (green * hueBright) / 16;
    blue = (blue * hueBright) / 16;
    Red = red;
    Green = green;
    Blue = blue;
    currentHue++;
}


// sometimes you might want the lights to act like they
// are being controlled via DMX or something.  this is how
// ic:ccc,ccc,ccc,dura
// 0123456789012345678

void setImmediateChange(char * commandReceived) {
    pwmChangeValues[0] = getInt(commandReceived, 3, 3);
    pwmChangeValues[1] = getInt(commandReceived, 7, 3);
    pwmChangeValues[2] = getInt(commandReceived, 11, 3);
    if (pwmChangeValues[0] == 0 && pwmChangeValues[1] == 0 &&
            pwmChangeValues[2] == 0) {
        fail(0x13);
        return;
    }
    int duration = getInt(commandReceived, 15, 4);
    if (pwmIsSet == 1) {
        // want to set a duration.
        if (duration == 0)
            immediateChange = (weeklySeconds + 5);
        else
            immediateChange = (weeklySeconds + duration);
        if (switchStatus[pwmSwitchNumber] < immediateChange)
            switchStatus[pwmSwitchNumber] = immediateChange;
        pwmOldValues[0] = Red;
        pwmOldValues[1] = Green;
        pwmOldValues[2] = Blue;
        Red = pwmChangeValues[0];
        Green = pwmChangeValues[1];
        Blue = pwmChangeValues[2];
        ok();
    } else {
        fail(0x14);
        return;
    }
}

void clearImmediateChange(void) {
    immediateChange = 0;
    Red = pwmOldValues[0];
    Green = pwmOldValues[1];
    Blue = pwmOldValues[2];
    switchChanged = 1;
}



/****************************************************************
 *
 *              All Things Program Related
 *
 ****************************************************************/

// programs and such kept in EEPROM
// 1 byte day of week mask or 0 for everyday
// 2 byte start time (minutes), 2 bytes duration (seconds), 1 byte additional program
// If more than 4 switches are desired it will roll over to an additional program
// DssddSSSSP
// 0123456789   
//static unsigned char weeklyProgram[MAX_PROGRAM][10];
//uart_puts_P("NewProgram, ClearProg, ProgAddSwitch, ProgDays, ProgTime, ProgDispln PN\r\n");
//uart_puts_P("NP:P#HHMMDur. - CP:P# - PA:P#S# PD:P#SMTWTFS-PT:P#HHMMDur. PI:P#\r\n");
//uart_puts_P("P#=Prog Num,HH=Hour,MM=Min,Dur.=Duration(min) SMTWTFS=1010000=Sun/Tue\r\n");

// Create a new program
// NP:HHMMDur.
// 0123456789012

void newProgram(char * commandReceived) {
    int programNumber = 255;
    int hours = 0;
    int minutes = 0;
    int startTime = 0;
    int duration = 0;
    int x = 0;
    // find an open program;
    for (x = 0; x < MAX_PROGRAM; x++) {
        // dont want it to wrap though 0 is a valid program
        if (weeklyProgram[x][0] == 255 && weeklyProgram[x][1] == 255) {
            // Use this one
            programNumber = x;
            // end the loop
            break;
        }
    }
    if (programNumber == 255) {
        fail(8);
        return;
    }
    clearTheProgram(programNumber);
    hours = getInt(commandReceived, 3, 2);
    minutes = getInt(commandReceived, 5, 2);
    duration = getInt(commandReceived, 7, 4);
    if (hours >= 24 || (hours == 0 && commandReceived[4] != '0')) {
        fail(9);
        return;
    }
    if (minutes >= 60 || (minutes == 0 && commandReceived[6] != '0')) {
        fail(0x0a);
        return;
    }
    if (duration == 0) {
        fail(0x0b);
        return;
    }
    duration *= 60; // convert to seconds
    startTime = (hours * 60);
    startTime += minutes; // stored in minutes
    int temp = 0;
    temp = (startTime >> 8);
    weeklyProgram[programNumber][1] = temp;
    temp = (startTime & 0xff);
    weeklyProgram[programNumber][2] = temp;
    temp = (duration >> 8);
    weeklyProgram[programNumber][3] = temp;
    temp = (duration & 0xff);
    weeklyProgram[programNumber][4] = temp;
    statusMsg[0] = 0;
    strcat(statusMsg, "New prog#");
    returnInt(programNumber, tempIntString);
    strcat(statusMsg, tempIntString);
    sendMessage(statusMsg);
}

// clears an existing program
// the clearTheProgram does the work so this is the interface
// CP:P#
// 01234

void clearProgram(char * commandReceived) {
    int programNumber = getSwitchNumber(commandReceived);
    if (programNumber >= MAX_PROGRAM || (programNumber == 0 && commandReceived[4] != '0')) {
        fail(2);
    } else {
        itoa(programNumber, tempIntString, 10);
        ok();
        clearTheProgram(programNumber);
    }
}

// zeros out the program

void clearTheProgram(int programNumber) {
    int x = 0;
    if (weeklyProgram[programNumber][9] != 255) {
        clearTheProgram((int) weeklyProgram[programNumber][9]);
    }
    // some of these "0" is a valid option so make it 255
    for (x = 0; x < 10; x++) {
        weeklyProgram[programNumber][x] = 255;
    }
}

// there are multiple switches per program.  This adds them.
// For memory constraints each program natively has up to 4
// switches.  For more than that another program will be linked
// Program in memory:
// DssddSSSSP
// 0123456789
// PA:P#S#
// 0123456

void programAddSwitch(char * commandReceived) {
    int programNumber = 0;
    int switchNumber = 0;
    programNumber = getInt(commandReceived, 3, 2);
    switchNumber = getInt(commandReceived, 5, 2);
    char switches[NUM_SWITCHES];
    switches[0] = 0;
    int switchCount = programGetSwitches(programNumber, switches);
    int x = 0;
    // see if the switch is already there
    for (x = 0; x < switchCount; x++) {
        if (switches[x] == switchNumber) {
            fail(0x0c);
            return;
        }
    }

    // check validity 
    if ((programNumber >= MAX_PROGRAM) || (programNumber == 0 && commandReceived[4] != '0')) {
        fail(2);
        return;
    }
    if ((switchNumber >= NUM_SWITCHES) || (switchNumber == 0 && commandReceived[6] != '0')) {
        fail(1);
        return;
    }
    // check for valid program
    // The day mask maxes out at 127 - the high but shouldn't be set if it is valid
    // unless it is a overflow program in which case the first switch will be set
    // 255 = not set
    if (weeklyProgram[programNumber][0] == 255 && weeklyProgram[programNumber][1] == 255) {
        fail(0x0d);
        return;
    }
    int noSwitchYet = 1;
    int blankSwitch = 0;
    int overflowProgram = 255;
    while (noSwitchYet == 1) {
        // see if our program has a valid switch
        blankSwitch = findOpenSwitch(programNumber);
        if (blankSwitch == 0) {
            // our program is full.  Find or make another one
            // first check if we already are overflowing.
            overflowProgram = weeklyProgram[programNumber][9];
            if (overflowProgram == 255) {
                // no overflow.  Need to create one.
                // find blank program slot
                int possibleBlank = 255;
                // yeah I know but programNumber 0 won't be an overflow so there
                for (x = (MAX_PROGRAM - 1); x > 0; x--) {
                    // dont want it to wrap though 0 is a valid program
                    if (weeklyProgram[x][0] == 255 && weeklyProgram[x][5] == 255) {
                        // this is blank
                        possibleBlank = x;
                        // end the loop
                        x = 0;
                    }
                }
                if (possibleBlank == 255) {
                    // oh oh, no room
                    fail(0x0e);
                    return;
                }
                // now record the overflow and move forward
                weeklyProgram[programNumber][9] = possibleBlank;
                programNumber = possibleBlank;
                // and now we loop again...
            } else {
                // move to overflow program and try again
                programNumber = overflowProgram;
            }
        } else { // if(blankSwitch == 0)
            // we have a program and a slot.  move on.
            noSwitchYet = 0;
        }
    }
    char test = weeklyProgram[programNumber][1];
    if (test == 255) {
        weeklyProgram[programNumber][1] = 0xfe;
    }
    weeklyProgram[programNumber][blankSwitch] = switchNumber;
    ok();
}

// iterates through a program and returns the index of an open switch or 0 if none

int findOpenSwitch(int programNumber) {
    int switchIndex = 0;
    int x = 0;
    for (x = 5; x < 9; x++) {
        if (weeklyProgram[programNumber][x] == 255) {
            // blank switch
            switchIndex = x;
            return switchIndex;
        }
    }
    return 0;
}

// Sets the days a program will run
// PD:P#SMTWTFS
// 012345678901

void programSetDays(char * commandReceived) {
    char tempReallyLongString[] = "0000000";
    int programNumber = 0;
    long weekLong = 0;
    programNumber = getInt(commandReceived, 3, 2);
    tempReallyLongString[0] = commandReceived[5];
    tempReallyLongString[1] = commandReceived[6];
    tempReallyLongString[2] = commandReceived[7];
    tempReallyLongString[3] = commandReceived[8];
    tempReallyLongString[4] = commandReceived[9];
    tempReallyLongString[5] = commandReceived[10];
    tempReallyLongString[6] = commandReceived[11];
    weekLong = strtol(tempReallyLongString, 0, 2);
    if ((programNumber >= MAX_PROGRAM) || (programNumber == 0 && commandReceived[4] != '0')) {
        fail(2);
        return;
    }
    // check for valid program
    // The day mask maxes out at 127 - the high but shouldn't be set if it is valid
    // unless it is a overflow program in which case the first switch will be set
    // 255 = not set
    if (weeklyProgram[programNumber][0] == 255 && weeklyProgram[programNumber][1] == 255) {
        fail(0x0d);
        return;
    }
    if ((weekLong & 0x7f) == 0) {
        fail(0x0f);
        return;
    }
    char weekdays = (weekLong & 0x7f);
    weeklyProgram[programNumber][0] = weekdays;
    ok();
}

// DssddSSSSP
// 0123456789   
// PT:P#HHMMDur.
// 0123456789012

void programSetTime(char * commandReceived) {
    int programNumber = 0;
    int hours = 0;
    int minutes = 0;
    int startTime = 0;
    int duration = 0;
    programNumber = getInt(commandReceived, 3, 2);
    if (programNumber >= MAX_PROGRAM || (programNumber == 0 && commandReceived[4] != '0')) {
        fail(2);
        return;
    }
    // check for valid program
    // The day mask maxes out at 127 - the high but shouldn't be set if it is valid
    // unless it is a overflow program in which case the first switch will be set
    // 255 = not set
    if (weeklyProgram[programNumber][0] == 255 && weeklyProgram[programNumber][1] == 255) {
        fail(0x0d);
        return;
    }
    hours = getInt(commandReceived, 5, 2);
    minutes = getInt(commandReceived, 7, 2);
    duration = getInt(commandReceived, 9, 4);
    if (hours >= 24 || (hours == 0 && commandReceived[6] != '0')) {
        fail(9);
        return;
    }
    if (minutes >= 60 || (minutes == 0 && commandReceived[8] != '0')) {
        fail(0x0a);
        return;
    }
    if (duration == 0) {
        fail(0x0b);
        return;
    }
    duration *= 60; // convert to seconds
    startTime = (hours * 60);
    startTime += minutes; // stored in minutes
    int temp = 0;
    temp = (startTime >> 8);
    weeklyProgram[programNumber][1] = temp;
    temp = (startTime & 0xff);
    weeklyProgram[programNumber][2] = temp;
    temp = (duration >> 8);
    weeklyProgram[programNumber][3] = temp;
    temp = (duration & 0xff);
    weeklyProgram[programNumber][4] = temp;
    ok();
}

void programDisplay(char * commandReceived) {
#ifndef SMALLER
    int x = 0;
    int programNumber = 0;
    programNumber = getInt(commandReceived, 3, 2);
    statusMsg[0] = 0;
    if (weeklyProgram[programNumber][0] == 255 && weeklyProgram[programNumber][1] == 255) {
        strcat(statusMsg, "Prog#");
        returnInt(programNumber, tempIntString);
        strcat(statusMsg, tempIntString);
        strcat(statusMsg, "blank.");
        sendMessage(statusMsg);
        return;
    }
    char switches[NUM_SWITCHES];
    switches[0] = 0;
    int switchCount = 0;
    switchCount = programGetSwitches(programNumber, switches);
    statusMsg[0] = 0;
    strcat(statusMsg, "Prog#");
    itoa(programNumber, tempIntString, 10);
    strcat(statusMsg, tempIntString);
    if (switchCount == 0) {
        strcat(switches, "S:-");
    } else {
        int temp = 0;
        strcat(statusMsg, "S");
        for (x = 0; x < switchCount; x++) {
            if (strlen(statusMsg) > 30) {
                sendMessage(statusMsg);
                statusMsg[6] = 0;
            }
            strcat(statusMsg, ":");
            temp = switches[x];
            itoa(temp, tempIntString, 10);
            strcat(statusMsg, tempIntString);
        }
    }
    sendMessage(statusMsg);
    statusMsg[0] = 0;
    unsigned int time = 0;
    time = weeklyProgram[programNumber][1];
    time <<= 8;
    time |= weeklyProgram[programNumber][2];
    unsigned int hours = (time / 60);
    unsigned int minutes = (time - (hours * 60));
    time = weeklyProgram[programNumber][3];
    time <<= 8;
    time |= weeklyProgram[programNumber][4];
    int duration = (time / 60);
    char weekdays = 0;
    weekdays = weeklyProgram[programNumber][0];
    strcat(statusMsg, "T-");
    returnInt(hours, tempIntString);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, ":");
    returnInt(minutes, tempIntString);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, " Dur:");
    returnInt(duration, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, " D:");
    char dayString[8];
    processDays(weekdays, dayString);
    strcat(statusMsg, dayString);
    sendMessage(statusMsg);
#endif
}

// programs and such kept in EEPROM
// 1 byte day of week mask or 0 for everyday
// 2 byte start time (seconds in day), 2 bytes duration (seconds), 1 byte additional program
// If more than 4 switches are desired it will roll over to an additional program
// DssddSSSSP
// 0123456789   
// programEdit - directly edits a program and assums that you know what you are doing
// PE:##ddssssddddswswswswPP - day of the week mask, start time (seconds in day), duration(seconds), 4 switches, 
// 0123456789012345678901234       next program (if you need more than 4 switches
// THIS FUNCTION IS TRUSTING YOU so DON'T DO IT IF YOU AREN'T COMFORTABLE
void programEdit(char * commandReceived) {
    int programNumber = getHexInt(commandReceived,3,2);
    int whichCharacter;
    int x;
    int temp;
    for (x = 0; x<10; x++) {
        whichCharacter = (x*2)+ 5;
        temp = getHexInt(commandReceived,whichCharacter,2);
        weeklyProgram[programNumber][x] = temp;
    }
    ok();
}


void processDays(int weekdays, char * dayString) {
    dayString[0] = 0;
    if (weekdays == 255) {
        strcat(dayString, "-------");
        return;
    }
    if (weekdays & 0x40) {
        strcat(dayString, "S");
    } else {
        strcat(dayString, "-");
    }
    if (weekdays & 0x20) {
        strcat(dayString, "M");
    } else {
        strcat(dayString, "-");
    }
    if (weekdays & 0x10) {
        strcat(dayString, "T");
    } else {
        strcat(dayString, "-");
    }
    if (weekdays & 0x08) {
        strcat(dayString, "W");
    } else {
        strcat(dayString, "-");
    }
    if (weekdays & 0x04) {
        strcat(dayString, "T");
    } else {
        strcat(dayString, "-");
    }
    if (weekdays & 0x02) {
        strcat(dayString, "F");
    } else {
        strcat(dayString, "-");
    }
    if (weekdays & 0x01) {
        strcat(dayString, "S");
    } else {
        strcat(dayString, "-");
    }
}

// get the switches for a program
// char * switches should be set as large as NUM_SWITCHES
// so you don't overflow

int programGetSwitches(int programNumber, char * switches) {
    int element = 0;
    int x = 0;
    // start loading the switch array
    while (1) {
        for (x = 5; x < 9; x++) {
            if (weeklyProgram[programNumber][x] == 255) {
                // blank switch we are done
                return element;
            } else {
                switches[element] = weeklyProgram[programNumber][x];
                element++;
            }
        } // for x=5-9
        // see if this program iterates around
        if (weeklyProgram[programNumber][9] == 255) {
            // we are done;
            return element;
        } else {
            // move to the next programNumber and continue
            programNumber = weeklyProgram[programNumber][9];
        }
    }
}

// takes in a program number and time and turns on the program
// SP P#Durat.
// 01234567890

void startProgram(char * commandReceived) {
    unsigned long duration;
    int programNumber = 0;
    // get switch number
    programNumber = getInt(commandReceived, 3, 2);
    if (programNumber >= MAX_PROGRAM) {
        fail(2);
        return;
    }
    // get duration
    duration = getLong(commandReceived, 5, 6);
    startTheProgram(programNumber, duration, 0);
    ok();
}

void startTheProgram(int programNumber, int duration, long time) {
    char switches[NUM_SWITCHES];
    int switchCount = 0;
    int thisSwitch = 0;
    int x = 0;

    if (duration == 0) {
        // get the duration since we weren't fed it
        duration = weeklyProgram[programNumber][3];
        duration <<= 8;
        duration = weeklyProgram[programNumber][4];
    }
    switchCount = programGetSwitches(programNumber, switches);
    // see if we were fed the start time so we don't go too long
    // this may run multiple times
    if (time == 0) {
        time = weeklySeconds + duration;
    }
    for (x = 0; x < switchCount; x++) {
        thisSwitch = switches[x];
        // only update the time if it is longer than what the switch is already turned on to
        if ((weeklySeconds + duration) > switchStatus[thisSwitch])
            switchStatus[thisSwitch] = time;
    }
    switchChanged = 1;
}


/****************************************************************
 *
 *              All Things EEPROM Related
 *
 ****************************************************************/

// Get variables out of EEPROM and set things up

void generalInit(void) {
    // read the program info
    char tempStuff[14];
    int x = 0;
    // Go through the addresses and assign them if set
    // decided later that this is a really bad idea. gets corrupted.  use default
    if (readEEPROM(tempStuff, RADIO_ADDR_TX, RADIO_ADDR_TX_BYTES) == 1) {
        tx_addr = formatAddress(tempStuff);
        writeAddr(TX_ADDR, tx_addr);
    }
    if (readEEPROM(tempStuff, RADIO_ADDR_R0, RADIO_ADDR_R0_BYTES) == 1) {
        rx_addr_p0 = formatAddress(tempStuff);
        writeAddr(RX_ADDR_P0, rx_addr_p0);
    }

    if (readEEPROM(tempStuff, RADIO_ADDR_R1, RADIO_ADDR_R1_BYTES) == 1) {
        rx_addr_p1 = formatAddress(tempStuff);
        writeAddr(RX_ADDR_P1, rx_addr_p1);
    }
    if (readEEPROM(tempStuff, RADIO_ADDR_R2, RADIO_ADDR_R2_BYTES) == 1) {
        rx_addr_p2 = tempStuff[0];
        writeAddr(RX_ADDR_P2, rx_addr_p2);
    }
    if (readEEPROM(tempStuff, RADIO_ADDR_R3, RADIO_ADDR_R3_BYTES) == 1) {
        rx_addr_p3 = tempStuff[0];
        writeAddr(RX_ADDR_P3, rx_addr_p3);
    }
    if (readEEPROM(tempStuff, RADIO_ADDR_R4, RADIO_ADDR_R4_BYTES) == 1) {
        rx_addr_p4 = tempStuff[0];
        writeAddr(RX_ADDR_P4, rx_addr_p4);
    }
    if (readEEPROM(tempStuff, RADIO_ADDR_R5, RADIO_ADDR_R5_BYTES) == 1) {
        rx_addr_p5 = tempStuff[0];
        writeAddr(RX_ADDR_P5, rx_addr_p5);
    }
    if (readEEPROM(tempStuff, INPUT_ADDR, INPUT_ADDR_BYTES) == 1) {
        inputAddr = formatAddress(tempStuff);
    }
    int adjustment;
    if (readEEPROM(tempStuff, TWEAK_TIMER, TWEAK_TIMER_BYTES) == 1) {
        adjustment = tempStuff[0];
        adjustment <<= 8;
        adjustment |= tempStuff[1];
        tweakTimer += adjustment;
    }


    // if we are receiving input messages and what time
    if (readEEPROM(tempStuff, INP_MESS_TIME, INP_MESS_TIME_BYTES) == 1) {
        inputMessageTiming = tempStuff[0];
        inputMessageTiming <<= 8;
        inputMessageTiming += tempStuff[1];
    }

    // the hue speed
    if (readEEPROM(tempStuff, HUESPEED, HUESPEED_BYTES) == 1) {
        hueSpeed = tempStuff[0];
        hueSpeed <<= 8;
        hueSpeed += tempStuff[1];
    }

    // color change speed
    if (readEEPROM(tempStuff, COL_CHANGE, COL_CHANGE_BYTES) == 1) {
        colorChangeSpeed = tempStuff[0];
        colorChangeSpeed <<= 8;
        colorChangeSpeed += tempStuff[1];
    }


    // process daylight savings
    if (readEEPROM(tempStuff, DAYLIGHT_SAVE, DAYLIGHT_SAVE_BYTES) == 1) {
        // Spring month
        daylightSavings[0][0] = ((tempStuff[0] << 8) | (tempStuff[1]));
        // Spring day
        daylightSavings[0][1] = ((tempStuff[2] << 8) | (tempStuff[3]));
        // Fall month
        daylightSavings[1][0] = ((tempStuff[4] << 8) | (tempStuff[5]));
        // Fall day
        daylightSavings[1][1] = ((tempStuff[6] << 8) | (tempStuff[7]));
    }


    // switches
    if (readEEPROM(switchStuff, SWITCH_STUFF, SWITCH_STUFF_BYTES) == 1) {
        volatile unsigned char *realPort = 0;
        volatile unsigned char *realDDR = 0;
        char realPin = 0;
        char temp = 0;
        // Pp - value of 255 (default) means nothing programmed
        // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
        // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
        for (x = 0; x < NUM_SWITCHES; x++) {
            temp = switchStuff[x];
            if (temp > 15 && temp < 32) {
                realPort = &PORTB;
                realDDR = &DDRB;
                temp -= 16;
#ifdef PINA
            } else if (temp < 16) {
                realPort = &PORTA;
                realDDR = &DDRA;
                temp -= 0;
#endif
#ifdef PINC
            } else if (temp < 48) {
                realPort = &PORTC;
                realDDR = &DDRC;
                temp -= 32;
#endif
#ifdef PIND
            } else if (temp < 64) {
                realPort = &PORTD;
                realDDR = &DDRD;
                temp -= 48;
#endif
#ifdef PINE
            } else if (temp < 80) {
                realPort = &PORTE;
                realDDR = &DDRE;
                temp -= 64;
#endif
#ifdef PINF
            } else if (temp < 96) {
                realPort = &PORTF;
                realDDR = &DDRF;
                temp -= 80;
#endif
#ifdef PING
            } else if (temp < 112) {
                realPort = &PORTG;
                realDDR = &DDRG;
                temp -= 96;
#endif
#ifdef PINH
            } else if (temp < 128) {
                realPort = &PORTH;
                realDDR = &DDRH;
                temp -= 112;
#endif
#ifdef PINI
            } else if (temp < 144) {
                realPort = &PORTI;
                realDDR = &DDRI;
                temp -= 128;
#endif
                // pwm setup
            } else {
                continue;
            }
            realPin = (temp / 2);
            *realDDR |= (1 << realPin);
            // figure out direction
            if (temp % 2 == 0) {
                // 0 = low is on  1 = high is on
                *realPort |= (1 << realPin);
            } else {
                *realPort &= ~(1 << realPin);
            }
        }
    } else {
        for (x = 0; x < NUM_SWITCHES; x++)
            switchStuff[x] = 255;
    }

    int memoryMarker = 0;
    int y = 0;
    // get the programs
    for (x = 0; x < MAX_PROGRAM; x++) {
        memoryMarker = (WEEKLY_PROGRAM + (x * WEEKLY_PROGRAM_BYTES));
        if (readEEPROM(tempStuff, memoryMarker, WEEKLY_PROGRAM_BYTES) == 1) {
            for (y = 0; y < 10; y++) {
                weeklyProgram[x][y] = tempStuff[y];
            }
        }
    }
    // get the inputs
    for (x = 0; x < NUM_INPUTS; x++) {
        memoryMarker = (INPUT + (x * INPUT_BYTES));
        if (readEEPROM(tempStuff, memoryMarker, INPUT_BYTES) == 1) {
            for (y = 0; y < 8; y++) {
                inputs[x][y] = tempStuff[y];
            }
        }
    }
    // get the time limits
    for (x = 0; x < NUM_LIMITS; x++) {
        memoryMarker = (LIMIT + (x * LIMIT_BYTES));
        if (readEEPROM(tempStuff, memoryMarker, LIMIT_BYTES) == 1) {
            for (y = 0; y < 3; y++) {
                timeLimits[x][y] = tempStuff[y];
            }
        }
    }

    if (readEEPROM(tempStuff, PWM_DIR, PWM_DIR_BYTES) == 1) {
        DDRD |= (1 << PIND3) | (1 << PIND5) | (1 << PIND6);
        // make sure initial values are 0
        Red = 0;
        Green = 0;
        Blue = 0;
        // Set output phase correct whatevers
        // set it to inverted if the direction is 0
        if (tempStuff[0] == 0) {
            TCCR0A = (1 << COM0A0) | (1 << COM0A1) | (1 << COM0B0) | (1 << COM0B1) | (1 << WGM00);
            TCCR2A = (1 << COM2B0) | (1 << COM2B1) | (1 << WGM20);
            pwmdir = 0;
        } else {
            TCCR0A = (1 << COM0A1) | (1 << COM0B1) | (1 << WGM00);
            TCCR2A = (1 << COM2B1) | (1 << WGM20);
            pwmdir = 1;
        }
        // F_CPU/64 timers
        TCCR0B = (1 << CS01) | (1 << CS00);

        TCCR2B = (1 << CS22); // F_CPU/64
    }

    // get the color change
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        memoryMarker = (COLOR_CHANGE + (x * COLOR_CHANGE_BYTES));
        if (readEEPROM(tempStuff, memoryMarker, COLOR_CHANGE_BYTES) == 1) {
            for (y = 0; y < 3; y++) {
                colorChanges[x][y] = tempStuff[y];
            }
        }
    }

    // what pwm the switch belongs to
    for (x = 0; x < NUM_SWITCHES; x++) {
        memoryMarker = (SWITCH_PWM + (x * SWITCH_PWM_BYTES));
        if (readEEPROM(tempStuff, memoryMarker, SWITCH_PWM_BYTES) == 1) {
            switchPWM[x] = tempStuff[0];
        }
    }


}

int readEEPROM(char * data, int memLocation, int memBytes) {
    uint16_t checkProgram;
    int x = 0;
    for (x = 0; x < 14; x++) {
        data[x] = 0;
    }
    // see if it has been programmed
    checkProgram = eeprom_read_word((uint16_t*) memLocation);
    // "DW" = 68,87 = 0x4457
    if (checkProgram == 0x4457) {
        // we've written here before. now get the data (except marker)
        eeprom_read_block((void*) data, (const void*) (memLocation + 2), (memBytes - 2));
        return 1;
    } else {
        return 0;
    }
}

void writeEEPROM(char * data, int memLocation, int memBytes) {
    uint16_t marker = 0x4457; // "DW" in ascii
    eeprom_update_block((const void*) data, (void*) (memLocation + 2), (memBytes - 2));
    eeprom_update_word((uint16_t*) memLocation, marker);
}

void clearEEPROM(int memLocation) {
    uint16_t marker = 0x0000; // blank it out
    eeprom_update_word((uint16_t*) memLocation, marker);
}

void saveToEEPROM(void) {
    char tempStuff[14];
    int x = 0;
    // Go through the addresses and assign them if set
    if (tx_addr > 0) {
        unformatAddress(tx_addr, tempStuff);
        writeEEPROM(tempStuff, RADIO_ADDR_TX, RADIO_ADDR_TX_BYTES);
    }
    if (rx_addr_p0 > 0) {
        unformatAddress(rx_addr_p0, tempStuff);
        writeEEPROM(tempStuff, RADIO_ADDR_R0, RADIO_ADDR_R0_BYTES);
    }
    if (rx_addr_p1 > 0) {
        unformatAddress(rx_addr_p1, tempStuff);
        writeEEPROM(tempStuff, RADIO_ADDR_R1, RADIO_ADDR_R1_BYTES);
    }
    if (rx_addr_p2 > 0) {
        tempStuff[0] = rx_addr_p2;
        writeEEPROM(tempStuff, RADIO_ADDR_R2, RADIO_ADDR_R2_BYTES);
    }
    if (rx_addr_p3 > 0) {
        tempStuff[0] = rx_addr_p3;
        writeEEPROM(tempStuff, RADIO_ADDR_R3, RADIO_ADDR_R3_BYTES);
    }
    if (rx_addr_p4 > 0) {
        tempStuff[0] = rx_addr_p4;
        writeEEPROM(tempStuff, RADIO_ADDR_R4, RADIO_ADDR_R4_BYTES);
    }
    if (rx_addr_p5 > 0) {
        tempStuff[0] = rx_addr_p5;
        writeEEPROM(tempStuff, RADIO_ADDR_R5, RADIO_ADDR_R5_BYTES);
    }
    if (inputAddr > 0) {
        unformatAddress(inputAddr, tempStuff);
        writeEEPROM(tempStuff, INPUT_ADDR, INPUT_ADDR_BYTES);
    }

    if (adjustment != 0) {
        tempStuff[0] = adjustment >> 8;
        tempStuff[1] = (adjustment & 0xff);
        writeEEPROM(tempStuff, TWEAK_TIMER, TWEAK_TIMER_BYTES);
    }



    if (daylightSavings[0][0] > 0) {
        tempStuff[0] = (daylightSavings[0][0] >> 8);
        tempStuff[1] = (daylightSavings[0][0] & 0xff);
        tempStuff[2] = (daylightSavings[0][1] >> 8);
        tempStuff[3] = (daylightSavings[0][1] & 0xff);
        tempStuff[4] = (daylightSavings[1][0] >> 8);
        tempStuff[5] = (daylightSavings[1][0] & 0xff);
        tempStuff[6] = (daylightSavings[1][1] >> 8);
        tempStuff[7] = (daylightSavings[1][1] & 0xff);
        writeEEPROM(tempStuff, DAYLIGHT_SAVE, DAYLIGHT_SAVE_BYTES);
    }
    char setupaSwitch = 0;
    char setupPWM = 0;

    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStuff[x] < 255)
            setupaSwitch = 1;
        if (switchStuff[x] >= 200 && switchStuff[x] <= 230)
            setupPWM = 1;
    }
    if (setupaSwitch == 1) {
        writeEEPROM(switchStuff, SWITCH_STUFF, SWITCH_STUFF_BYTES);
    }
    tempStuff[0] = pwmdir;
    if (setupPWM == 1)
        writeEEPROM(tempStuff, PWM_DIR, PWM_DIR_BYTES);

    int memoryMarker;




    // save the programs
    int y = 0;
    for (x = 0; x < MAX_PROGRAM; x++) {
        memoryMarker = (WEEKLY_PROGRAM + (x * WEEKLY_PROGRAM_BYTES));
        if (weeklyProgram[x][0] != 255 || weeklyProgram[x][1] != 255) {
            for (y = 0; y < 10; y++)
                tempStuff[y] = weeklyProgram[x][y];
            writeEEPROM(tempStuff, memoryMarker, WEEKLY_PROGRAM_BYTES);
        }
    }

    // save the inputs
    for (x = 0; x < NUM_INPUTS; x++) {
        memoryMarker = (INPUT + (x * INPUT_BYTES));
        if (inputs[x][0] != 255) {
            for (y = 0; y < 8; y++) {
                tempStuff[y] = inputs[x][y];
            }
            writeEEPROM(tempStuff, memoryMarker, INPUT_BYTES);
        }
    }

    // save the time limits
    for (x = 0; x < NUM_LIMITS; x++) {
        memoryMarker = (LIMIT + (x * LIMIT_BYTES));
        if (timeLimits[x][2] > 0) {
            for (y = 0; y < 3; y++) {
                tempStuff[y] = timeLimits[x][y];
            }
            writeEEPROM(tempStuff, memoryMarker, INPUT_BYTES);
        }
    }



    // save the color change
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        memoryMarker = (COLOR_CHANGE + (x * COLOR_CHANGE_BYTES));
        if (colorChanges[0][0] != 0 || colorChanges[0][1] != 1 || colorChanges[0][2] != 0) {
            for (y = 0; y < 3; y++) {
                tempStuff[y] = colorChanges[x][y];
            }
            writeEEPROM(tempStuff, memoryMarker, COLOR_CHANGE_BYTES);
        }
    }


    // what pwm the switch belongs to
    for (x = 0; x < NUM_SWITCHES; x++) {
        memoryMarker = (SWITCH_PWM + (x * SWITCH_PWM_BYTES));
        tempStuff[0] = switchPWM[x];
        writeEEPROM(tempStuff, memoryMarker, SWITCH_PWM_BYTES);
    }


    // if we are receiving input messages and what time
    tempStuff[0] = (inputMessageTiming >> 8);
    tempStuff[1] = (inputMessageTiming & 0xff);
    writeEEPROM(tempStuff, INP_MESS_TIME, INP_MESS_TIME_BYTES);

    tempStuff[0] = (hueSpeed >> 8);
    tempStuff[1] = (hueSpeed & 0xff);
    writeEEPROM(tempStuff, HUESPEED, HUESPEED_BYTES);

    tempStuff[0] = (colorChangeSpeed >> 8);
    tempStuff[1] = (colorChangeSpeed & 0xff);
    writeEEPROM(tempStuff, COL_CHANGE, COL_CHANGE_BYTES);

    ok();
}

/*
 * Create ability to dump memory items through the radio
 * Note: this is a rather trusting function so use at your own risk
 * MW:AAAABBCdata--------------
 * 0123456789012345678901234567
 * AAAA = memory address BB = # bytes C = checksum (add up all digits of data then 0xff)
 */
void memoryWrite(char * commandReceived) {
    unsigned int address;
    int bytes, checksum, checkDigit, checksumFromCommand, x;
    char data[9];
    checksumFromCommand = 0;
    address = getHexInt(commandReceived, 3, 4);
    // bytes is really characters sent.  Oh Well.
    bytes = getHexInt(commandReceived, 7, 2);
    if (bytes > 16) {
        fail(0x17);
        return;
    }
    if ((bytes % 2) != 0) {
        fail(0x16);
        return;
    }
    checksum = getHexInt(commandReceived, 9, 1);
    // populate data and calculate checksom
    for (x = 0; x < bytes; x += 2) {
        checkDigit = getHexInt(commandReceived, (x + 10), 2);
        checksumFromCommand += checkDigit;
        data[(x / 2)] = checkDigit;
    }
    checksumFromCommand = checksumFromCommand & 0x0F;
    if (checksum == checksumFromCommand) {
        eeprom_update_block((const void*) data, (void*) address, (bytes / 2));
        ok();
    } else {
        fail(0x15);
    }

}

/*
 * Create ability to read memory items through the radio
 * MR:AAAAB
 * 0123456789012345678901234567
 * AAAA = memory address BB = # bytes 
 */
void memoryRead(char * commandReceived) {
    unsigned int address;
    int bytes, x;
    char data[9];
    address = getHexInt(commandReceived, 3, 4);
    // bytes is really characters sent.  Oh Well.
    bytes = getHexInt(commandReceived, 7, 2);
    if (bytes > 8) {
        fail(0x17);
        return;
    }
    eeprom_read_block(data, (void*) address, bytes);
    statusMsg[0] = 0;
    for (x = 0; x < bytes; x++) {
        returnHexWithout(data[(x * 2)], tempLongString);
        strcat(statusMsg, tempLongString);
        returnHexWithout(data[((x * 2) + 1)], tempLongString);
        strcat(statusMsg, tempLongString);
    }
    sendMessage(statusMsg);
}

/* dump the contents of the memory across the radio
*/
void memoryDump(void) {
    statusMsg[0] = 0;
    int x = 0;
    int linecount = 0;
    int imAnInt = 0;

    // First line is miscellaneous stuff
    // Tweaktimer, daylightsavings (4 bytes), pwm direction
    strcat(statusMsg, "M00-");
    returnHexWithout(tweakTimer, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(daylightSavings[0][0], tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(daylightSavings[0][1], tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(daylightSavings[1][0], tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(daylightSavings[1][1], tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(pwmdir, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(inputMessageTiming, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");

    linecount++;
    resetStatus(linecount, "M");

    returnHexWithout(hueSpeed, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "|");
    returnHexWithout(colorChangeSpeed, tempLongString);
    strcat(statusMsg, tempLongString);


    linecount++;
    resetStatus(linecount, "S");

    for (x = 0; x < NUM_SWITCHES; x++) {
        imAnInt = switchStuff[x];
        returnHexWithout(imAnInt, tempLongString);
        strcat(statusMsg, tempLongString);
        returnHexWithout(switchPWM[x], tempLongString);
        strcat(statusMsg, tempLongString);
        if (strlen(statusMsg) >= 28 && (x + 1) < NUM_SWITCHES) {
            sendMessage(statusMsg);
            linecount++;
            statusMsg[1] = 0;
            interjectLineNumber(linecount);
        }
    }
    linecount++;
    resetStatus(linecount, "P");


    // now dump the programs a byte at a time.
    int y = 0;
    for (x = 0; x < MAX_PROGRAM; x++) {

        for (y = 0; y < 10; y++) {
            returnHexWithout(weeklyProgram[x][y], tempLongString);
            strcat(statusMsg, tempLongString);
            //if (strlen(statusMsg) >= 30) {
            //    sendMessage(statusMsg);
            //    linecount++;
            //    statusMsg[1] = 0;
            //    interjectLineNumber(linecount);
            //}
        }
        sendMessage(statusMsg);
        if(x < (MAX_PROGRAM-1)) {
            linecount++;
            statusMsg[1] = 0;
            interjectLineNumber(linecount);
        }
    }

    linecount++;
    resetStatus(linecount, "I");
    // input bytes now
    for (x = 0; x < NUM_INPUTS; x++) {

        for (y = 0; y < 8; y++) {
            returnHexWithout(inputs[x][y], tempLongString);
            strcat(statusMsg, tempLongString);
            if (strlen(statusMsg) >= 30) {
                sendMessage(statusMsg);
                linecount++;
                statusMsg[1] = 0;
                interjectLineNumber(linecount);
            }
        }
    }

    linecount++;
    resetStatus(linecount, "T");
    // time limits
    char tempReallyLongString[] = "0000000";
    for (x = 0; x < NUM_LIMITS; x++) {
        for (y = 0; y < 3; y++) {
            if (y < 2) {
                returnLongHexWithout(timeLimits[x][y], tempReallyLongString);
                strcat(statusMsg, tempReallyLongString);
            } else {
                returnHexWithout(timeLimits[x][y], tempLongString);
                strcat(statusMsg, tempLongString);
            }
            if (strlen(statusMsg) >= 30) {
                sendMessage(statusMsg);
                linecount++;
                statusMsg[1] = 0;
                interjectLineNumber(linecount);
            }
        }
    }

    linecount++;
    resetStatus(linecount, "C");
    // save the color change
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        for (y = 0; y < 3; y++) {
            returnHexWithout(colorChanges[x][y], tempLongString);
            strcat(statusMsg, tempLongString);
        }
        if (colorIsChangable[x] == 1)
            strcat(statusMsg, "Y");
        else
            strcat(statusMsg, "N");
        if (strlen(statusMsg) >= 24) {
            sendMessage(statusMsg);
            linecount++;
            statusMsg[1] = 0;
            interjectLineNumber(linecount);
        }
    }

    linecount++;
    resetStatus(linecount, "END");
    returnHexWithout(globalYear, tempLongString);
    strcat(statusMsg, tempLongString);
    returnHexWithout(globalMonth, tempLongString);
    strcat(statusMsg, tempLongString);
    returnHexWithout(globalDay, tempLongString);
    strcat(statusMsg, tempLongString);
    returnHexWithout(globalHour, tempLongString);
    strcat(statusMsg, tempLongString);
    returnHexWithout(globalMinute, tempLongString);
    strcat(statusMsg, tempLongString);
    returnHexWithout(globalSecond, tempLongString);
    strcat(statusMsg, tempLongString);
    sendMessage(statusMsg);
}

void interjectLineNumber(int lineNumber) {
    returnHexWithout(lineNumber, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "-");
}

void resetStatus(int linecount, char * letter) {
    sendMessage(statusMsg);
    statusMsg[0] = 0;
    strcat(statusMsg, letter);
    interjectLineNumber(linecount);
}

void clearToEEPROM(void) {
    int x = 0;
    clearEEPROM(DAYLIGHT_SAVE);
    clearEEPROM(RADIO_ADDR_TX);
    clearEEPROM(RADIO_ADDR_R0);
    clearEEPROM(RADIO_ADDR_R1);
    clearEEPROM(RADIO_ADDR_R2);
    clearEEPROM(RADIO_ADDR_R3);
    clearEEPROM(RADIO_ADDR_R4);
    clearEEPROM(RADIO_ADDR_R5);
    clearEEPROM(INPUT_ADDR);
    clearEEPROM(SWITCH_STUFF);
    clearEEPROM(PWM_DIR);
    for (x = 0; x < NUM_INPUTS; x++)
        clearEEPROM((INPUT + (x * INPUT_BYTES)));
    for (x = 0; x < NUM_LIMITS; x++)
        clearEEPROM((LIMIT + (x * LIMIT_BYTES)));
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        clearEEPROM((COLOR_CHANGE + (x * COLOR_CHANGE_BYTES)));
    }
    for (x = 0; x < MAX_PROGRAM; x++)
        clearEEPROM((WEEKLY_PROGRAM + (x * WEEKLY_PROGRAM_BYTES)));
    for (x = 0; x < NUM_SWITCHES; x++)
        clearEEPROM((SWITCH_PWM + (x * SWITCH_PWM_BYTES)));
    clearEEPROM(TWEAK_TIMER);
    clearEEPROM(INP_MESS_TIME);
    ok();

}

/****************************************************************
 *
 *              All Things Clock Related
 *
 ****************************************************************/


// initialize the clock

void clockInit(void) {
    // Set CTC mode (clear timer on compare)
    TCCR1A = 0;
    TCCR1B = (1 << WGM12);
    OCR1A = TIMER_RESET;
    TIMSK1 = (1 << OCIE1A); // set interrupt
}

// we received a time command.  set the clock
// Must be this format:
// TI:MMDDYYYYHHMMSS
// 012345678901234567

void setClock(char * commandReceived) {
    long tempInt;
    // iterate through and get the times.
    // Month
    globalMonth = getInt(commandReceived, 3, 2);
    // Day
    globalDay = getInt(commandReceived, 5, 2);
    // hour
    globalHour = getInt(commandReceived, 11, 2);
    // minute
    globalMinute = getInt(commandReceived, 13, 2);
    // second
    globalSecond = getInt(commandReceived, 15, 2);
    // year
    globalYear = getInt(commandReceived, 7, 4);
    dow = getWeekday(globalYear, globalMonth, globalDay); // get day of week
    tempInt = dow;
    tempInt = tempInt * 24 * 60 * 60;
    weeklySeconds = tempInt;
    tempInt = globalHour;
    tempInt = tempInt * 60 * 60;
    weeklySeconds += tempInt;
    tempInt = globalMinute;
    tempInt = tempInt * 60;
    weeklySeconds += tempInt;
    weeklySeconds += globalSecond;
    clockString();
    sendMessage(statusMsg);
    stopClock();
    startClock();
    panicMyClockIsNotSet = 0;
    if ((failCondition & 1) == 1)
        clearFail(1);
}


// Change the clock values to a string

void clockString(void) {
    statusMsg[0] = 0;

    strcat(statusMsg, " ");
    returnInt(globalMonth, tempIntString);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, "/");
    returnInt(globalDay, tempIntString);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, "/");
    itoa(globalYear, tempIntString, 10);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, " ");
    returnInt(globalHour, tempIntString);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, ":");
    returnInt(globalMinute, tempIntString);
    strcat(statusMsg, tempIntString);
    strcat(statusMsg, ":");
    returnInt(globalSecond, tempIntString);
    strcat(statusMsg, tempIntString);
}

// start the clock

void startClock(void) {
    TCNT1 = 65535;
    TCCR1B |= TIMER_CLOCK_SEL;
}

void stopClock(void) {
    TCCR1B &= ~(TIMER_CLOCK_SEL);
}

// returns the weekday - sunday = 0

int getWeekday(int year, int month, int day) {
    int adj, mm, yy;

    adj = (14 - month) / 12; // Jan is 13, feb is 14 in calculation
    mm = month + 12 * adj - 2;
    yy = globalYear - adj;
    return ((day + (13 * mm - 1) / 5 + yy + yy / 4 - yy / 100 + yy / 400) % 7);
}

// returns the day of the year (1 - 365 or 366)

int getDayofYear(int year, int month, int day) {
    int months[12] = {0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30};
    int x = 0;
    // adjust feb for leap year
    if ((year % 4) == 0)
        months[3] = 29;
    // start with the day of the month, then add amounts for each month
    int doy = day;
    for (x = 0; x < month; x++) {
        doy += months[x];
    }
    return doy;
}

// Sets up the days we do daylight savings
// DS:MMDD MMDD
// 012345678901

void setDaylightSavings(char * commandReceived) {
    daylightSavings[0][0] = getInt(commandReceived, 3, 2);
    daylightSavings[0][1] = getInt(commandReceived, 5, 2);
    daylightSavings[1][0] = getInt(commandReceived, 8, 2);
    daylightSavings[1][1] = getInt(commandReceived, 10, 2);
    ok();
}

// Decide if this 2:00am is daylight savings and adjust accordingly

void checkDaylightSavings(void) {
    // have we adjusted for daylight savings?
    if (wasDaylightSavings == 1)
        return;
    if (globalMonth == daylightSavings[0][0] && globalDay == daylightSavings[0][1]) {
        wasDaylightSavings = 1;
        globalHour++;
    } else if (globalMonth == daylightSavings[1][0] && globalDay == daylightSavings[1][1]) {
        wasDaylightSavings = 1;
        globalHour--;
    }
}

// Advance a day in the calendar. 

void advanceDay(void) {
    int x = 0;
    // Reset the daylight savings for next time
    wasDaylightSavings = 0;
    // start with dow
    dow++;
    if (dow == 7) {
        // reset it to Sunday
        dow = 0;
        weeklySeconds = 0;
        // switchStatus might be more than a week (604,800 seconds)
        for (x = 0; x < NUM_SWITCHES; x++) {
            if (switchStatus[x] >= 604800)
                switchStatus[x] -= 604800;
        }
    }
    // then the day
    globalDay++;
    // If we aren't advancing a month just move on
    if (globalDay <= 28) {
        return;
    }
    // possibly advancing a month
    switch (globalMonth) {
        // 30 days have september, april, june and november
        case 4:
        case 6:
        case 9:
        case 11:
            if (globalDay > 30) {
                globalDay = 1;
                globalMonth++;
            } else {
                return;
            }
            break;
        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
            if (globalDay > 31) {
                globalDay = 1;
                globalMonth++;
            } else {
                return;
            }
            break;
        case 12:
            if (globalDay > 31) {
                // happy new year
                globalDay = 1;
                globalMonth = 1;
                globalYear++;
            } else {
                return;
            }
            break;
        case 2:
            // leap year?
            if (globalYear % 4 == 0) {
                // yes
                if (globalDay > 29) {
                    globalDay = 1;
                    globalMonth++;
                } else {
                    return;
                }
            } else {
                if (globalDay > 28) {
                    globalDay = 1;
                    globalMonth++;
                } else {
                    return;
                }
            }
            break;
    }
    return;
}

// runs every second.  Checks to see if we need to turn something on or off

void timerCheck(void) {
    int x = 0;
    for (x = 0; x < NUM_SWITCHES; x++) {
        // see if something should turn off
        if ((switchStatus[x] > 0) && (switchStatus[x] < weeklySeconds)) {
            switchChanged = 1;
            switchStatus[x] = 0;
            if(switchStuff[x] == 200) {
                PWMInUse = 0;
            }
        }
    }
    // see if something should turn on
    // weeklyProgram format
    // DssddSSSSP
    // 0123456789
    long time;
    int today = 0;
    int duration = 0;
    for (x = 0; x < MAX_PROGRAM; x++) {
        // check if there is a valid program
        if (weeklyProgram[x][0] != 255 && weeklyProgram[x][1] != 255) { // yes
            // see if it goes today
            // if dow = 0 (sunday) the program stores this as 0x40 then down from there
            today = (0x40 >> dow);
            // k is today the day?
            if (weeklyProgram[x][0] & today) {

                // yes we run today
                time = weeklyProgram[x][1];
                time <<= 8;
                time |= weeklyProgram[x][2];
                // weeklyProgram is stored in minutes
                time *= 60;
                duration = weeklyProgram[x][3];
                duration <<= 8;
                duration |= weeklyProgram[x][4];
                time += (dow * 86400); //seconds in day
                // check if we are between start & stop time
                if ((weeklySeconds >= time) && (weeklySeconds < (time + duration))) {
                    // feed time to it so the end time won't change
                    startTheProgram(x, 0, time);
                }
            }
        }
    }
}

// iterate through the switches and turn them on or off

void switchOnOff(void) {
    char port[1];
    char pin[1];
    int realPin = 0;
    int x = 0;
    char activePWM = 0;
    char direction[1];
    volatile unsigned char *thisPort = 0;
    // need a second quick loop to see if an active pwm is going on so we don't turn it off
    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStuff[x] >= 200 && switchStuff[x] <= 220) {
            if (switchStatus[x] > 0)
                // we have a pwm switch turned on with more time left.
                activePWM = 1;
        }
    }
    // check if we have a switch overriding a PWM
    if (switchPWMOverride < 99) {
        if (switchStatus[switchPWMOverride] == 0) {
            // time is up for the input switch
            switchPWMOverride = 99;
        }
    }

    for (x = 0; x < NUM_SWITCHES; x++) {
        // see if a switch is set up
        if (switchStuff[x] != 255) {
            // find out if this is pwm
            if (switchStuff[x] >= 200 && switchStuff[x] <= 220) {
                // are we turning it on or off
                if (switchStatus[x] == 0 && activePWM == 0) {
                    // turning it off
                    if (switchStuff[x] == 200) {
                        Red = 0;
                        Green = 0;
                        Blue = 0;
                        PWMInUse = 0;
                    } else if (switchStuff[x] == 201) {
                        Red = 0;
                        Green = 0;
                        Blue = 0;
                        hueBright = switchPWM[x];
                        runHue = 0;
                    } else if (switchStuff[x] == 202) {
                        Red = 0;
                        Green = 0;
                        Blue = 0;
                        runColorChanges = 0;
                    }
                    // now don't override if we are changing it ourselves
                } else if (switchStatus[x] > 0 && immediateChange == 0
                        // also need to check if an input is overriding the normal pwm
                        && (switchPWMOverride == 99 || switchPWMOverride == x)
                        ) {
                    // turn it on
                    // decide if it is a changing hue or static values
                    if (switchStuff[x] == 200) {
                        int temp = switchPWM[x];
                        // even numbers are static colors;
                        red = colorChanges[temp][0];
                        green = colorChanges[temp][1];
                        blue = colorChanges[temp][2];
                        Red = red;
                        Green = green;
                        Blue = blue;
                        PWMInUse = 1;
                    } else if (switchStuff[x] == 202) {
                        runColorChanges = 1;
                    } else {
                        // get the hue cycle going
                        runHue = 1;
                        hueBright = switchPWM[x];
                    }
                }
                continue;
            }
            // switch is set up. Get details
            getPort(x, port, pin, direction);
            // yeah pointers and casts and whatevers. this fixes it
            realPin = pin[0];
            if (port[0] == 'B')
                thisPort = &PORTB;
#ifdef PORTA
            else if (port[0] == 'A')
                thisPort = &PORTA;
#endif
#ifdef PORTC
            else if (port[0] == 'C')
                thisPort = &PORTC;
#endif
#ifdef PORTD
            else if (port[0] == 'D')
                thisPort = &PORTD;
#endif
#ifdef PORTE
            else if (port[0] == 'E')
                thisPort = &PORTE;
#endif
#ifdef PORTF
            else if (port[0] == 'F')
                thisPort = &PORTF;
#endif
#ifdef PORTG
            else if (port[0] == 'G')
                thisPort = &PORTG;
#endif
#ifdef PORTH
            else if (port[0] == 'H')
                thisPort = &PORTH;
#endif
#ifdef PORTI
            else if (port[0] == 'I')
                thisPort = &PORTI;
#endif
            // k we have the port - now decide if we are turning it on or off and turn it on/off
            if (switchStatus[x] == 0) {
                // turning it off
                if (direction[0] == 0) {
                    *thisPort |= (1 << realPin);
                } else {
                    *thisPort &= ~(1 << realPin);
                }
            } else {
                // turning it on
                if (direction[0] == 0) {
                    *thisPort &= ~(1 << realPin);
                } else {
                    *thisPort |= (1 << realPin);
                }
            }
        }
    }
}

// sets the time limits for switches to affect progams
// TL:##HHMMHHMMddddddd
// 01234567890123456789

void setTimeLimits(char * commandReceived) {
    char tempReallyLongString[] = "0000000";
    int programNumber = 0;
    long weekLong = 0;
    long startTime = 0;
    long stopTime = 0;
    int x = 0;
    statusMsg[0] = 0;
    unsigned int startHour, startMinute, stopHour, stopMinute;
    tempIntString[0] = commandReceived[3];
    tempIntString[1] = commandReceived[4];
    programNumber = atoi(tempIntString);
    if (programNumber > NUM_LIMITS) {
        fail(0x10);
        return;
    }
    if (commandReceived[5] == 'x' || commandReceived[5] == 'x') {
        timeLimits[programNumber][2] = 0;
        ok();
        return;
    }
    if (commandReceived[5] == '?') {
#ifndef SMALLER
        // show the limit.
        startTime = timeLimits[programNumber][0];
        stopTime = timeLimits[programNumber][1];
        startHour = (startTime / 60 / 60);
        returnInt(startHour, tempLongString);
        strcat(statusMsg, tempLongString);
        startMinute = (startTime - (startHour * 60 * 60));
        startMinute = startMinute / 60;
        strcat(statusMsg, ":");
        returnInt(startMinute, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, " - ");
        stopHour = (stopTime / 60 / 60);
        returnInt(stopHour, tempLongString);
        strcat(statusMsg, tempLongString);
        stopMinute = (stopTime - (stopHour * 60 * 60));
        stopMinute = stopMinute / 60;
        strcat(statusMsg, ":");
        returnInt(stopMinute, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, "Days");
        int weekdays = timeLimits[programNumber][2];
        processDays(weekdays, tempReallyLongString);
        strcat(statusMsg, tempReallyLongString);
        sendMessage(statusMsg);
#endif
        return;
    }
    for (x = 0; x < 7; x++) {
        tempReallyLongString[x] = commandReceived[x + 13];
    }
    weekLong = strtol(tempReallyLongString, 0, 2);
    startHour = getInt(commandReceived, 5, 2);
    startMinute = getInt(commandReceived, 7, 2);
    stopHour = getInt(commandReceived, 9, 2);
    stopMinute = getInt(commandReceived, 11, 2);
    if (startHour > 23 || stopHour > 23) {
        fail(0x09);
        return;
    }
    if (startMinute > 59 || stopMinute > 59) {
        fail(0x0A);
        return;
    }
    startTime = startHour;
    startTime = startTime * 60 * 60;
    startTime += (startMinute * 60);
    stopTime = stopHour;
    stopTime = stopTime * 60 * 60;
    stopTime += (stopMinute * 60);
    timeLimits[programNumber][0] = startTime;
    timeLimits[programNumber][1] = stopTime;
    timeLimits[programNumber][2] = weekLong;
    ok();

}

// take in 3 digits to tweak the clock time
// CT xxxx
// 0123456

void clockTweak(char * commandReceived) {
    int tempnum = getInt(commandReceived, 3, 4);
    if (tempnum == 0) {
        itoa(tweakTimer, tempLongString, 10);
        statusMsg[0] = 0;
        strcat(statusMsg, "T:");
        strcat(statusMsg, tempLongString);
        itoa(adjustment, tempLongString, 10);
        strcat(statusMsg, "A:");
        strcat(statusMsg, tempLongString);
        sendMessage(statusMsg);
        return;
    }
    tweakTimer += tempnum;
    adjustment = tempnum;
    ok();
}

/****************************************************************
 *
 *              All Things debug and output Related
 *
 ****************************************************************/






// sends a general status
// basically an overview of the system

void generalStatus(char * commandReceived) {
    statusMsg[0] = 0;
    tempIntString[0] = commandReceived[2];
    tempIntString[1] = commandReceived[3];


    if (panicMyClockIsNotSet == 1) {
        strcat(statusMsg, " T:xx/xx/xxxx xx:xx:xx");
    } else {
        strcat(statusMsg, " T:");
        returnInt(globalMonth, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, "/");
        returnInt(globalDay, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, "/");
        returnInt(globalYear, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, " ");
        returnInt(globalHour, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, ":");
        returnInt(globalMinute, tempLongString);
        strcat(statusMsg, tempLongString);
        strcat(statusMsg, ":");
        returnInt(globalSecond, tempLongString);
        strcat(statusMsg, tempLongString);
    }
    sendMessage(statusMsg);
    statusMsg[0] = 0;
    if (commandReceived[2] == 'q')
        return;

    programsProgrammed();
    switchesProgrammed();
    inputsProgrammed();
    switchesOn();
}

// returns a basic view of the capabilities

void generalInformation(void) {
    statusMsg[0] = 0;
    strcat(statusMsg, "Pr,");
    int count = 0;
    int x;
    for (x = 0; x < MAX_PROGRAM; x++) {
        if (weeklyProgram[x][0] < 255 || weeklyProgram[x][1] < 255)
            count++;
    }
    returnInt(count, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "/");
    returnInt(MAX_PROGRAM, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, ",Sw,");
    count = 0;
    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStuff[x] < 255)
            count++;
    }
    returnInt(count, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "/");
    returnInt(NUM_SWITCHES, tempLongString);
    strcat(statusMsg, tempLongString);
    sendMessage(statusMsg);
    statusMsg[0] = 0;
    strcat(statusMsg, ",In,");
    count = 0;
    for (x = 0; x < NUM_INPUTS; x++) {
        if (inputs[x][0] < 255)
            count++;
    }
    returnInt(count, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "/");
    returnInt(NUM_INPUTS, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, ",Li,");
    count = 0;
    for (x = 0; x < NUM_LIMITS; x++) {
        if (inputs[x][2] > 0)
            count++;
    }
    returnInt(count, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "/");
    returnInt(NUM_LIMITS, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, ",CC,");
    count = 0;
    for (x = 0; x < NUM_COLOR_CHANGES; x++) {
        if (colorChanges[x][0] != 0 || colorChanges[x][1] != 1 || colorChanges[x][2] != 0)
            count++;
    }
    returnInt(count, tempLongString);
    strcat(statusMsg, tempLongString);
    strcat(statusMsg, "/");
    returnInt(NUM_COLOR_CHANGES, tempLongString);
    strcat(statusMsg, tempLongString);
    sendMessage(statusMsg);
}

// transmits Y or N for which programs have been programmed

void programsProgrammed(void) {
    statusMsg[0] = 0;
    strcat(statusMsg, "Progs:");
    int x;
    for (x = 0; x < MAX_PROGRAM; x++) {
        if (weeklyProgram[x][0] == 255 && weeklyProgram[x][1] == 255) {
            strcat(statusMsg, "n");
        } else {
            strcat(statusMsg, "y");
        }
        // can only send 32 bytes at a time
        if (strlen(statusMsg) > 30) {
            sendMessage(statusMsg);
            statusMsg[6] = 0;
        }
    }
    sendMessage(statusMsg);
}
// transmits Y or N for which switches have been programmed

void switchesProgrammed(void) {
    statusMsg[0] = 0;
    strcat(statusMsg, "Swi:");
    int x;
    for (x = 0; x < NUM_SWITCHES; x++) {

        if (switchStuff[x] == 255) {
            strcat(statusMsg, "n");
        } else {
            strcat(statusMsg, "y");
        }
        // can only send 32 bytes at a time
        if (strlen(statusMsg) > 30) {
            sendMessage(statusMsg);
            statusMsg[4] = 0;
        }
    }
    sendMessage(statusMsg);
}

// transmits Y or N for which inputs have been programmed

void inputsProgrammed(void) {
    statusMsg[0] = 0;
    strcat(statusMsg, "Inp:");
    int x;
    for (x = 0; x < NUM_INPUTS; x++) {
        if (inputs[x][0] == 255) {
            strcat(statusMsg, "n");
        } else {
            strcat(statusMsg, "y");
        }
        // can only send 32 bytes at a time
        if (strlen(statusMsg) > 30) {
            sendMessage(statusMsg);
            statusMsg[4] = 0;
        }
    }
    sendMessage(statusMsg);
}

// transmits Y or N for which switches are currently turned on

void switchesOn(void) {
    statusMsg[0] = 0;
    strcat(statusMsg, "SwOn:");
    int x;
    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStatus[x] > 0) {
            strcat(statusMsg, "y");
        } else {
            strcat(statusMsg, "n");
        }
        if (strlen(statusMsg) > 30) {
            sendMessage(statusMsg);
            statusMsg[5] = 0;
        }
    }
    sendMessage(statusMsg);
}

void returnInt(int number, char * thisString) {
    thisString[0] = 0;
    itoa(number, tempHugeString, 10);
    if (strlen(tempHugeString) == 1)
        strcat(thisString, "0");
    strcat(thisString, tempHugeString);
}

void returnHex(unsigned int number, char * thisString) {
    thisString[0] = 0;
    strcat(thisString, "0x");
    itoa(number, tempHugeString, 16);
    if (strlen(tempHugeString) == 1 || strlen(tempHugeString) == 3)
        strcat(thisString, "0");
    strcat(thisString, tempHugeString);
}



// print hex without 0x

void returnHexWithout(unsigned int number, char * tempMe) {
    tempMe[0] = 0;
    itoa(number, tempHugeString, 16);
    if (strlen(tempHugeString) == 1 || strlen(tempHugeString) == 3)
        strcat(tempMe, "0");
    strcat(tempMe, tempHugeString);
}

void returnLongHexWithout(unsigned long number, char * tempMe) {
    tempMe[0] = 0;
    ltoa(number, tempHugeString, 16);
    int count = strlen(tempHugeString);
    while (count < 6) {
        strcat(tempMe, "0");
        count++;
    }
    strcat(tempMe, tempHugeString);
}


/****************************************************************
 *
 *              All Things Radio Related
 *
 ****************************************************************/

// initialize the radio

void radioInit(void) {
    nrfInit();
    rx_addr_p0 = SET_RX_ADDR_P0;
    tx_addr = SET_TX_ADDR;
    // use defaults the radio has
    rx_addr_p1 = readAddr(RX_ADDR_P1);
    rx_addr_p2 = readAddr(RX_ADDR_P2);
    rx_addr_p3 = readAddr(RX_ADDR_P3);
    rx_addr_p4 = readAddr(RX_ADDR_P4);
    rx_addr_p5 = readAddr(RX_ADDR_P5);
    radioInit2();
}

// splitting things up so we can re-run this later but not lose the address

void radioInit2(void) {
    writeReg(RF_SETUP, SET_RF_SETUP);
    writeAddr(RX_ADDR_P0, rx_addr_p0);
    writeAddr(TX_ADDR, tx_addr);
    writeReg(DYNPD, SET_DYNPD);
    writeReg(FEATURE, SET_FEATURE);
    writeReg(RF_CH, SET_RF_CH);
    writeReg(CONFIG, SET_CONFIG);
    writeReg(SETUP_RETR, SET_SETUP_RETR);

    // We've written the address - now see if we get the same result
    radioTest();

    startRadio();
    startRx();
}

// radio test - just make sure it is still working

int radioTest(void) {
    uint64_t test_addr;
    test_addr = readAddr(RX_ADDR_P0);
    if (test_addr != rx_addr_p0) {
        // nope.  broken
        failCondition |= 2;
        return -1;
    }
    if ((failCondition & 2) == 2)
        clearFail(2);
    if ((failCondition & 4) == 4)
        clearFail(4);
    return 1;
}

// Take in an address and return a long long with the number

uint64_t formatAddress(char * address) {
    int x = 0;
    uint64_t newAddress = 0;
    int tempInt;
    for (x = 0; x < 5; x++) {
        tempInt = address[x];
        if (x < 4) {
            newAddress |= (tempInt);
            newAddress <<= 8;
        } else
            newAddress |= tempInt;
    }
    return newAddress;
}

// send receive addresses
//static uint64_t rx_addr_p0, rx_addr_p1, rx_addr_p2, rx_addr_p3, rx_addr_p4, rx_addr_p5, tx_addr;

// display's a given address
//RD:N RC:N 0xnnnnnnnnnn
//0123

void radioDisplayAddress(char * commandReceived) {
#ifndef SMALLER
    int x = 0;
    char tempRadioString[6];
    statusMsg[0] = 0;
    if (commandReceived[3] == '1') {
        unformatAddress(rx_addr_p1, tempRadioString);
        strcat(statusMsg, "r1-0x");
    } else if (commandReceived[3] == '2') {
        unformatAddress(rx_addr_p2, tempRadioString);
        strcat(statusMsg, "r2-0x");
    } else if (commandReceived[3] == '3') {
        unformatAddress(rx_addr_p3, tempRadioString);
        strcat(statusMsg, "r3-0x");
    } else if (commandReceived[3] == '4') {
        unformatAddress(rx_addr_p4, tempRadioString);
        strcat(statusMsg, "r4-0x");
    } else if (commandReceived[3] == '5') {
        unformatAddress(rx_addr_p5, tempRadioString);
        strcat(statusMsg, "r5-0x");
    } else if (commandReceived[3] == 'T') {
        unformatAddress(tx_addr, tempRadioString);
        strcat(statusMsg, "t-0x");
    } else if (commandReceived[3] == 'I') {
        unformatAddress(inputAddr, tempRadioString);
        strcat(statusMsg, "i-0x");
    } else {
        unformatAddress(rx_addr_p0, tempRadioString);
        strcat(statusMsg, "r0-0x");
    }
    for (x = 0; x < 5; x++) {
        returnHexWithout(tempRadioString[x], tempLongString);
        strcat(statusMsg, tempLongString);
    }
    sendMessage(statusMsg);
#endif
}

// change the radio address
// send receive addresses
//static uint64_t rx_addr_p0, rx_addr_p1, rx_addr_p2, rx_addr_p3, rx_addr_p4, rx_addr_p5, tx_addr;

//RD:N RC:N 0xnnnnnnnnnn
//     01234567890123456

void radioChangeAddress(char * commandReceived) {
    int x = 0;
    statusMsg[0] = 0;
    int tempInt = 0;
    uint64_t newAddress = 0;
    char tempString[] = "0x00";
    char tempRadioString[] = "00000";
    for (x = 0; x < 5; x++) {
        tempString[2] = commandReceived[((x * 2) + 7)];
        tempString[3] = commandReceived[((x * 2) + 8)];
        tempInt = strtol(tempString, 0, 0);
        newAddress |= tempInt;
        if (x < 4)
            newAddress <<= 8;
    }
    switch (commandReceived[3]) {
        case '0':
            rx_addr_p0 = newAddress;
            strcat(statusMsg, "r0 0x");
            writeAddr(RX_ADDR_P0, newAddress);
            break;
        case '1':
            rx_addr_p1 = newAddress;
            strcat(statusMsg, "r1 0x");
            writeAddr(RX_ADDR_P1, newAddress);
            break;
        case '2':
            rx_addr_p2 = newAddress;
            strcat(statusMsg, "r2 0x");
            writeAddr(RX_ADDR_P2, newAddress);
            break;
        case '3':
            rx_addr_p3 = newAddress;
            strcat(statusMsg, "r3 0x");
            writeAddr(RX_ADDR_P3, newAddress);
            break;
        case '4':
            rx_addr_p4 = newAddress;
            strcat(statusMsg, "r4 0x");
            writeAddr(RX_ADDR_P4, newAddress);
            break;
        case '5':
            rx_addr_p5 = newAddress;
            strcat(statusMsg, "r5 0x");
            writeAddr(RX_ADDR_P5, newAddress);
            break;
        case 'T':
            tx_addr = newAddress;
            strcat(statusMsg, "t 0x");
            writeAddr(TX_ADDR, newAddress);
            break;
        case 'I':
            inputAddr = newAddress;
            strcat(statusMsg, "i 0x");
            break;
    }
    unformatAddress(newAddress, tempRadioString);
    for (x = 0; x < 5; x++) {
        returnHexWithout(tempRadioString[x], tempLongString);
        strcat(statusMsg, tempLongString);
    }
    sendMessage(statusMsg);
}


// take the int and return the array

void unformatAddress(uint64_t oldAddress, char * formattedAddress) {
    uint64_t tempInt = oldAddress;
    formattedAddress[4] = (tempInt & 0xff);
    tempInt >>= 8;
    formattedAddress[3] = (tempInt & 0xff);
    tempInt >>= 8;
    formattedAddress[2] = (tempInt & 0xff);
    tempInt >>= 8;
    formattedAddress[1] = (tempInt & 0xff);
    tempInt >>= 8;
    formattedAddress[0] = (tempInt & 0xff);
}

void sendMessage(char * myResponse) {
    stopRx();
    _delay_us(10);
    int transmitLength = strlen(myResponse);
    if (!transmit(myResponse, transmitLength)) {
        failCondition |= 4;
    } else {
        if ((failCondition & 2) == 2)
            clearFail(2);
        if ((failCondition & 4) == 4)
            clearFail(4);
    }
    startRx();
}

// we need to track if the sending worked or not so here goes

void sendInputMessage(void) {
    stopRx();
    _delay_us(10);
    if (inputAddr > 0) {
        writeAddr(TX_ADDR, inputAddr);
        writeAddr(RX_ADDR_P0, inputAddr);
    }
    int transmitLength = strlen(inputMessage);
    if (!transmit(inputMessage, transmitLength)) {
        writeAddr(TX_ADDR, tx_addr);
        writeAddr(RX_ADDR_P0, rx_addr_p0);
        return;
    } else {
        inputMessageAttempts = 0;
        inputMessage[0] = 0;
        writeAddr(TX_ADDR, tx_addr);
        writeAddr(RX_ADDR_P0, rx_addr_p0);
    }
}


/****************************************************************
 *
 *              All Things Input Related
 *
 ****************************************************************/

// sets up an input on one of the analog pins
// DI:##Ppx?##DuraPO
// AI:##PpLLLHHH?##DuraPOw
// 0123456789012345678901234
// int Port/pin like switches, low%,high%, switch/program, dur, poll time
// inputs[NUM_INPUTS]

void setAnalogInput(char * commandReceived) {
    int x = 0;
    int inputNumber, lowPercent, highPercent, pollTime, outputNum, duration;
    char pin = 0;
    inputNumber = lowPercent = highPercent = pollTime = outputNum = duration = 0;
    int switchNumber = 0;
    long temp = 0;
    char whichRGB = 0;
    inputNumber = getInt(commandReceived, 3, 2);
    if (inputNumber >= NUM_INPUTS) {
        fail(0x11);
        return;
    }
    pin = getInt(commandReceived, 6, 1);
    if (pin > 7) {
        fail(0x04);
        return;
    }

    switchNumber = getInt(commandReceived, 14, 2);

    pollTime = getInt(commandReceived, 20, 2);
    whichRGB = getInt(commandReceived, 22, 1);

    lowPercent = getInt(commandReceived, 7, 3);
    highPercent = getInt(commandReceived, 10, 3);

    duration = getInt(commandReceived, 16, 4);

    // pLHsDDP p int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
    // 0123456
    // dur in seconds, poll time in secs or  0 for continuous. 
    // #= analogIn num, p=pin, LLL=low%, HHH=High%,? = 'P'rog or 'S', ## = num
    // Durat. = duration in seconds, POLL = poll time in seconds or 0 for 1/10
    if (commandReceived[5] != 'C' && commandReceived[5] != 'c') {
        fail(0x03);
        return;
    }
    // Port / Pin
    // value of 255 (default) means nothing programmed
    // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
    // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
    // pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
    // port is C.  This is analog in so its not normal but need to set the DDR anyway
    // get the pin
    temp = pin * 2;
    // add # for port C
    temp += 32;
    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStuff[x] == temp) {

            fail(0x12);
            return;
        }
    }
    inputs[inputNumber][0] = temp;
    DDRC &= ~(1 << pin);
    temp = lowPercent;
    temp = temp * 255;
    temp = temp / 100;
    inputs[inputNumber][1] = temp;
    temp = highPercent;
    temp = temp * 255;
    temp = temp / 100;
    if (temp == 255) // if the top is 255 we need it to be 254 so its not digital
        temp = 254;

    inputs[inputNumber][2] = temp;
    // 128 switches and 128 programs possible
    if (commandReceived[13] == 'P' || commandReceived[13] == 'p') {
        switchNumber += 128;
    }
    inputs[inputNumber][3] = switchNumber;
    temp = duration >> 8;
    inputs[inputNumber][4] = temp;
    temp = duration & 0xff;
    inputs[inputNumber][5] = temp;


    if (pollTime > 255)
        pollTime = 255;
    inputs[inputNumber][6] = pollTime;

    // if we are using a RGB switch then which ones do we activate (mask)
    if (whichRGB > 7)
        whichRGB = 7;
    inputs[inputNumber][7] = whichRGB;


    // set ADMUX when we do a conversion
    // Set prescaler 1/32. why not... ;-)
    ADCSRA |= (1 << ADPS2) || (1 << ADPS0);


    ok();
}

// set up an input on a regular pin
// DI:##Ppx?##DuraPO
// 012345678901234567890
// #=digital in num, P=Port,p=pin, x=High or Low, ?='P'rog or 'S'witch,
// ## = prog/switch num, Durat.=duration in seconds, POLL=poll time in sec or 0 for 1/10

void setDigitalInput(char * commandReceived) {
    int x = 0;
    int inputNumber, pollTime, outputNum, duration;
    volatile unsigned char *realDDR = 0;
    volatile unsigned char *realPort = 0;
    char pin = 0;
    inputNumber = pollTime = outputNum = duration = 0;
    int switchNumber = 0;
    int temp = 0;
    inputNumber = getInt(commandReceived, 3, 2);
    if (inputNumber >= NUM_INPUTS) {
        fail(0x11);
        return;
    }
    pin = getInt(commandReceived, 6, 1);
    if (pin > 7) {
        fail(0x04);
        return;
    }

    switchNumber = getInt(commandReceived, 9, 2);
    ;

    pollTime = getInt(commandReceived, 15, 2);

    duration = getInt(commandReceived, 11, 4);
    // if we are activating a program
    if (commandReceived[8] == 'P' || commandReceived[8] == 'p') {
        switchNumber += 128;
    }
    temp = pin * 2;
    if (commandReceived[5] == 'B' || commandReceived[5] == 'b') {
        realDDR = &DDRB;
        realPort = &PORTB;
        temp += 16;
#ifdef PORTA
    } else if (commandReceived[5] == 'A' || commandReceived[5] == 'a') {
        realDDR = &DDRA;
        realPort = &PORTA;
        temp += 0;
#endif        
#ifdef PORTC
    } else if (commandReceived[5] == 'C' || commandReceived[5] == 'c') {
        realDDR = &DDRC;
        realPort = &PORTC;
        temp += 32;
#endif        
#ifdef PORTD
    } else if (commandReceived[5] == 'D' || commandReceived[5] == 'd') {
        realDDR = &DDRD;
        realPort = &PORTD;
        temp += 48;
#endif        
#ifdef PORTE
    } else if (commandReceived[5] == 'E' || commandReceived[5] == 'e') {
        realDDR = &DDRE;
        realPort = &PORTE;
        temp += 64;
#endif        
#ifdef PORTF
    } else if (commandReceived[5] == 'F' || commandReceived[5] == 'f') {
        realDDR = &DDRF;
        realPort = &PORTF;
        temp += 80;
#endif        
#ifdef PORTG
    } else if (commandReceived[5] == 'G' || commandReceived[5] == 'g') {
        realDDR = &DDRG;
        realPort = &PORTG;
        temp += 96;
#endif        
#ifdef PORTH
    } else if (commandReceived[5] == 'H' || commandReceived[5] == 'h') {
        realDDR = &DDRH;
        realPort = &PORTH;
        temp += 112;
#endif        
#ifdef PORTI
    } else if (commandReceived[5] == 'I' || commandReceived[5] == 'i') {
        realDDR = &DDRI;
        realPort = &PORTI;
        temp += 128;
#endif        
    }
    // value of 255 (default) means nothing programmed
    // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
    // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG
    // pin is abs(value/2)-the base - PINB3 = (22-16)/2  PINB3 (22-16)%2 = 0 - low (23-16)%2 = 1 - high
    // port is C.  This is analog in so its not normal but need to set the DDR anyway
    // get the pin
    for (x = 0; x < NUM_SWITCHES; x++) {
        if (switchStuff[x] == temp || switchStuff[x] == (temp + 1)) {
            fail(0x12);
            return;
        }
    }

    inputs[inputNumber][0] = temp;

    if (commandReceived[7] == 'H' || commandReceived[7] == 'h' ||
            commandReceived[7] == '1') {
        inputs[inputNumber][1] = 0;
        inputs[inputNumber][2] = 255;
    } else {
        inputs[inputNumber][1] = 255;
        inputs[inputNumber][2] = 0;
    }
    inputs[inputNumber][3] = switchNumber;
    temp = duration >> 8;
    inputs[inputNumber][4] = temp;
    temp = duration & 0xff;
    inputs[inputNumber][5] = temp;

    if (pollTime > 255)
        pollTime = 255;
    inputs[inputNumber][6] = pollTime;

    *realDDR &= ~(1 << pin);
    *realPort |= (1 << pin);

    ok();
    // DI:##Ppx?##DuraPO
    // 012345678901234567890
}

// inputs[NUM_INPUTS] - is the following
// pLHsDDP p int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
// 0123456
// Port / Pin
// value of 255 (default) means nothing programmed
// value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
// 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG

// see if we check any inputs this second

void inputCheck(void) {
    int x = 0;
    int pollTime = 0;
    // figure out if we care about our inputs
    for (x = 0; x < NUM_INPUTS; x++) {
        // see if it is a valid input
        if (inputs[x][0] == 255)
            continue; // not valid. Skip
        pollTime = inputs[x][6];
        // see if it is one we check continuously or every second
        if (pollTime == 0 || pollTime == 1) {
            getInput(x);
            // see if we it is the right second otherwise
        } else if (weeklySeconds % pollTime == 0) {
            getInput(x);
        }
    }
}

// see if we check inputs continuously (every 10th)

void inputTenthCheck(void) {
    int x = 0;
    for (x = 0; x < NUM_INPUTS; x++) {
        // see if it is valid and marked continuously
        if (inputs[x][0] != 255 && inputs[x][6] == 0)
            getInput(x);
    }
}

// inputs[NUM_INPUTS] - is the following
// pLHsDDPw p int pin/port like sw, L%,H% (0,255 - digital), s - 0-127=switch, 128-255 = prog
// 01234567 - w= which analog out if needed
// Port / Pin
// value of 255 (default) means nothing programmed
// value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
// 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG


// actually check the input and do something based on that

void getInput(int inputNumber) {
    int timeLimitTest = 0;
    unsigned int outputNum, duration, low, high, switchNumber;
    volatile unsigned char *thisPin = 0;
    long temp = 0;
    char pwmValue = 0;
    char whichRGB = 0;
    int programNumber = 0;
    timeLimitTest = testTimeLimit();
    // set up how many seconds are at the beginning of today
    outputNum = duration = low = high = switchNumber = 0;
    outputNum = inputs[inputNumber][0];
    low = inputs[inputNumber][1];
    high = inputs[inputNumber][2];
    switchNumber = inputs[inputNumber][3];
    if(switchNumber > 128)
        programNumber = switchNumber - 128;
    temp = inputs[inputNumber][4];
    duration = (temp << 8);
    temp = inputs[inputNumber][5];
    duration |= temp;
    whichRGB = inputs[inputNumber][7];
    // if this is an analog input than both the low% or the high% will not be 255
    if (low != 255 && high != 255) {
        // this is an analog input
        // currently only port C is supported for analog inputs
        temp = outputNum - 32;
        temp = temp / 2;
        if (temp > 7) // if things got goofed up somehow 
            return;
        ADMUX = temp; // which pin to check
        ADCSRA |= (1 << ADEN) | (1 << ADSC); // turn on ADC and start a conversion
        loop_until_bit_is_set(ADCSRA, ADIF);
        temp = ADC;
        temp = temp * 255;
        temp = temp / 1024; // now its a number between 0 and 255;
        ADCSRA |= (1 << ADIF); // clear the ADC
        // see if we are turning on the switch
        if (temp > low && temp < (high + 1)) {
            possibleInputMessage(inputNumber);
            // see if it is a PWM switch (not a program)
            if (switchNumber < 128 && switchStuff[switchNumber] == 200) {
                // this is a PWM so we're doing it based on the relative ADC value
                // see if we are using the whole range.
                if ((high - low) > 250) {
                    pwmValue = temp;
                } else {
                    // figure out what percentage between the values we are
                    char range = high - low;
                    temp = temp - low;
                    temp = temp * 255;
                    temp = temp / range; // now we have a relative value between 0&255
                    pwmValue = temp;
                    // see if we are changing RGB
                    if (whichRGB & 4)
                        Red = pwmValue;
                    if (whichRGB & 2)
                        Green = pwmValue;
                    if (whichRGB & 1)
                        Blue = pwmValue;
                    if (whichRGB & 7) // if anything changed
                        switchChanged = 1;
                }
            }
            // k we set up PWM now make it so it switches on
            if (switchNumber < 128) { // its a switch
                if (switchStatus[switchNumber] == 0) // the switch is off
                    switchChanged = 1;
                if (switchStatus[switchNumber] < (weeklySeconds + duration))
                    switchStatus[switchNumber] = (weeklySeconds + duration);
            } else { // its a program - so test the time limit
                if (timeLimitTest == 0)
                    return;
                startTheProgram(programNumber, duration, 0);
            }
        }

    } else {
        // this is a digital input
        // value of 255 (default) means nothing programmed
        // value of 0-15 = PORTA, 16-31 = PORTB, 32-47 = PORTC, 
        // 48-63 = PORTD, 64-79 = PORTE, 80-95 = PORTF, 96-112 = PORTG        
        // figure out what we are dealing with and check it.
        temp = outputNum;
        if (temp > 15 && temp < 32) {
            thisPin = &PINB;
            temp -= 16;
#ifdef PINA
        } else if (temp < 16) {
            thisPin = &PINA;
            temp -= 0;
#endif
#ifdef PINC
        } else if (temp < 48) {
            thisPin = &PINC;
            temp -= 32;
#endif
#ifdef PIND
        } else if (temp < 64) {
            thisPin = &PIND;
            temp -= 48;
#endif
#ifdef PINE
        } else if (temp < 80) {
            thisPin = &PINE;
            temp -= 64;
#endif
#ifdef PINF
        } else if (temp < 96) {
            thisPin = &PINF;
            temp -= 80;
#endif
#ifdef PING
        } else if (temp < 112) {
            thisPin = &PING;
            temp -= 96;
#endif
#ifdef PINH
        } else if (temp < 128) {
            thisPin = &PINH;
            temp -= 112;
#endif
#ifdef PINI
        } else if (temp < 144) {
            thisPin = &PINI;
            temp -= 128;
#endif
        } else {
            // something went wrong.  Who cares.
            return;
        }
        // if we want the input to be high then low = 0.  If we want it to be 
        // low to be on then low = 255;
        temp = temp / 2;
        if (temp > 7) {
            return; // something wrong again
        }
        int pinsOn = *thisPin;
        char yeaOurInputIsOn = 0;
        if (pinsOn & (1 << temp)) {
            // pin is high
            if (low == 0)
                yeaOurInputIsOn = 1;
        } else {
            // pin is low
            if (low == 255)
                yeaOurInputIsOn = 1;
        }
        if (yeaOurInputIsOn == 1) {
            possibleInputMessage(inputNumber);
            if (switchNumber < 128) { // this is a switch
                if (switchStatus[switchNumber] == 0) // the switch is off
                    switchChanged = 1;
                if ((switchStatus[switchNumber]) < (weeklySeconds + duration))
                    switchStatus[switchNumber] = (weeklySeconds + duration);
                // if switch is a PWM then we want it to be a priority and override other pwm color
                if (switchStuff[switchNumber] >= 200)
                    switchPWMOverride = switchNumber;
            } else { // its a program;
                if (timeLimitTest == 0)
                    return;
                startTheProgram(programNumber, duration, 0);
            }
        }
    }
}

int testTimeLimit(void) {
    int x = 0;
    long temp = 0;
    char test = 0;
    // set up how many seconds are at the beginning of today
    long daySeconds = (dow * 86400);
    long startTime, stopTime;
    for (x = 0; x < NUM_LIMITS; x++) {
        if (timeLimits[x][2] > 0)
            test = 1;
    }
    // no limits set up
    if (test == 0)
        return 1;
    for (x = 0; x < NUM_LIMITS; x++) {
        startTime = timeLimits[x][0];
        stopTime = timeLimits[x][1];
        // deal with nights that cross midnight
        if (stopTime < startTime) {
            temp = dow;
            // weekly seconds resets at the end of the week. so do lots of 9
            if (weeklySeconds <= (stopTime + daySeconds)) {
                // k this is dow + 1
                if (temp == 0)
                    temp = 6;
                else
                    temp--;
                if ((timeLimits[x][2] & (1 << temp)) > 0)
                    return 1;
            } else if (weeklySeconds >= (startTime + daySeconds)) {
                if ((timeLimits[x][2] & (1 << dow)) > 0)
                    return 1;
            }
        } else {
            if (weeklySeconds >= (startTime + daySeconds) &&
                    weeklySeconds <= (stopTime + daySeconds)) {
                if (((timeLimits[x][2] & (1 << dow)) > 0))
                    return 1;
            }
        }
    } // end of the for
    return 0;
}

/*
 * An input has turned on.  Figure out if we need to send a message
 */
void possibleInputMessage(int inputNumber) {
    // send a switch message
    // inputMessageGathered is the last time we send the message + the input timing
    if (inputMessageTiming > 0 && weeklySeconds > inputMessageGathered[inputNumber]) {
        char tempRadioString[6];
        unformatAddress(rx_addr_p0, tempRadioString);
        strcat(inputMessage, "Rad: 0x");
        int x;
        for (x = 0; x < 5; x++) {
            returnHexWithout(tempRadioString[x], tempLongString);
            strcat(inputMessage, tempLongString);
        }

        returnHex(inputNumber, tempLongString);
        inputMessageGathered[inputNumber] = weeklySeconds + inputMessageTiming;
        strcat(inputMessage, "Inp: 0x");
        strcat(inputMessage, tempLongString);
    }
}

/*
 * Input message - this is the number of seconds between when we get a positive input
 * for a message and we wait until we get a positive again.  0 = no messages
 * IT:xxxx
 * 0123456
 */
void setInputMessageTiming(char * commandReceived) {
    inputMessageTiming = getHexInt(commandReceived, 3, 4);
    ok();
}

// clears an input
// CI nn = input number

void clearInput(char * commandReceived) {
    int inputNumber = 0;
    volatile unsigned char *thisPort = 0;
    tempIntString[0] = commandReceived[3];
    tempIntString[1] = commandReceived[4];
    inputNumber = atoi(tempIntString);
    int temp = inputs[inputNumber][0];
    if (temp > 15 && temp < 32) {
        thisPort = &PINB;
        temp -= 16;
#ifdef PINA
    } else if (temp < 16) {
        thisPort = &PINA;
        temp -= 0;
#endif
#ifdef PINC
    } else if (temp < 48) {
        thisPort = &PINC;
        temp -= 32;
#endif
#ifdef PIND
    } else if (temp < 64) {
        thisPort = &PIND;
        temp -= 48;
#endif
#ifdef PINE
    } else if (temp < 80) {
        thisPort = &PINE;
        temp -= 64;
#endif
#ifdef PINF
    } else if (temp < 96) {
        thisPort = &PINF;
        temp -= 80;
#endif
#ifdef PING
    } else if (temp < 112) {
        thisPort = &PING;
        temp -= 96;
#endif
#ifdef PINH
    } else if (temp < 128) {
        thisPort = &PINH;
        temp -= 112;
#endif
#ifdef PINI
    } else if (temp < 144) {
        thisPort = &PINI;
        temp -= 128;
#endif
    } else {
        ok();
        return;
    }
    // zero out the port
    *thisPort &= ~(1 << temp);
    inputs[inputNumber][0] = 255;
    ok();
}

/****************************************************************
 *
 *              All Things Interrupt and on offish Related
 *
 ****************************************************************/


// Flashes the indicator pin to determine problems

void flashFail(void) {
    failTimer++;
    INDICATOR_DDR |= INDICATOR_PIN;
    // different timings for different fails
    if (failTimer == 2) {
        INDICATOR_PORT |= INDICATOR_PIN;
    } else if (failTimer == 4) {
        INDICATOR_PORT &= ~(INDICATOR_PIN);
    }
    if ((failCondition & 2) == 2) {
        if (failTimer == 8) {
            INDICATOR_PORT |= INDICATOR_PIN;
        } else if (failTimer == 10) {
            INDICATOR_PORT &= ~(INDICATOR_PIN);
        }
    }
    if ((failCondition & 4) == 4) {
        if (failTimer == 14) {
            INDICATOR_PORT |= INDICATOR_PIN;
        } else if (failTimer == 16) {
            INDICATOR_PORT &= ~(INDICATOR_PIN);
        }
    }
    if (failTimer == 24)
        failTimer = 0;
}


// turns off the indicator pin

void clearFail(char fail) {
    statusMsg[0] = 0;
    failCondition = (failCondition & ~(fail));
    failTimer = 0;
    INDICATOR_PORT |= (INDICATOR_PIN);
    INDICATOR_DDR |= (INDICATOR_PIN);
}

// do a full chip reset (useful when we reprogram EEPROM)

void resetMe(void) {
    cli();
    wdt_enable(WDTO_1S);
    while (1);
}

ISR(TIMER1_COMPA_vect) {
    ticks++;
    tenthTicks++;
    // if its been a second
    if (ticks >= tweakTimer) {
        ticks = 0;
        globalSecond++;
        weeklySeconds++;
        newSecond = 1;
        if (globalSecond == 60) {
            globalMinute++;
            globalSecond = 0;
            newMinute = 1;
            if (globalMinute == 60) {
                globalHour++;
                globalMinute = 0;
                // daylight savings is always at 2am
                if (globalHour == 2)
                    checkDaylightSavings();
                if (globalHour == 24) {
                    globalHour = 0;
                    advanceDay();
                }
            }
        }
    }
    if (tenthTicks >= TIMER_TENTH) {
        tenthFlag = 1;
        tenthTicks = 0;
    }
}
