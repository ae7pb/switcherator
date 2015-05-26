#include <stdlib.h>
#include <string.h>
#include <avr/io.h>
#include <avr/interrupt.h>

#include <avr/eeprom.h>
#include <avr/pgmspace.h>
#include <util/delay.h>
#include "../myavrnrflib/nRF24L01.h"
#define DATA_SIZE 32 // For radio
#include "../myavrnrflib/nrf.h"
#include "../myavrnrflib/spi.h"



// Max program - depends on ram & EEPROM
// As it is the program uses 605 bytes of RAM with all of these set to zero
#define BASE_PROG_RAM           605     // so we can make sure we aren't using too much ram
#define MAX_PROGRAM             24
#define NUM_SWITCHES            24
#define NUM_INPUTS              8
#define NUM_LIMITS              8
#define NUM_COLOR_CHANGES       20
#define NUM_PWM                 1


// Radio settings
#define SET_RF_SETUP    (0 << RF_DR_HIGH | 3 << RF_PWR) // 1Mbps & high power
#define SET_RX_ADDR_P0  0xf0f0f0f001
#define SET_TX_ADDR     0xf0f0f0f001
// dynamic payload all pipes
#define SET_DYNPD       (1 << DPL_P5)|(1 << DPL_P4)|(1 << DPL_P3)|(1<< DPL_P2)|(1<<DPL_P1)|(1 << DPL_P0)
// enable dynamic payload
#define SET_FEATURE     (1 << EN_DPL)
// config - just the default
#define SET_CONFIG      (1 << EN_CRC)
// actual frequency
#define SET_RF_CH       110 // outside of wifi 
// 15 retries before giving up
#define SET_SETUP_RETR  0x0f




// EEPROM sizes in 8 bit bytes (include 2 byte marker)
#define RADIO_ADDR_TX_BYTES      7
#define RADIO_ADDR_R0_BYTES      7
#define RADIO_ADDR_R1_BYTES      7
#define RADIO_ADDR_R2_BYTES      3
#define RADIO_ADDR_R3_BYTES      3
#define RADIO_ADDR_R4_BYTES      3
#define RADIO_ADDR_R5_BYTES      3
#define INPUT_ADDR_BYTES         7
#define DAYLIGHT_SAVE_BYTES     10
#define SERIAL_NUM_BYTES         8
// these depend on options above
#define SWITCH_STUFF_BYTES      (NUM_SWITCHES + 2)
#define INPUT_BYTES             ( 8 + 2 )
#define LIMIT_BYTES             ( 3 + 2)
#define COLOR_CHANGE_BYTES      ( 3 + 2)
#define WEEKLY_PROGRAM_BYTES    (10 + 2)
#define TWEAK_TIMER_BYTES       4
#define PWM_DIR_BYTES           3
#define BRIGHTNESS_BYTES        (NUM_SWITCHES + 2)
#define SWITCH_PWM_BYTES        3
#define COLOR_CHANGABLE_BYTES   3
#define INP_MESS_TIME_BYTES     4
#define HUESPEED_BYTES          4
#define COL_CHANGE_BYTES        4
#define GLOBAL_BRIGHT_BYTES     4

// Timer Variables
// if F_CPU = 16Mhz then 1 second is 125 cycles counting to 125
// at F_CPU/1024
#define TIMER_CLOCK_SEL (1 << CS12)|(1 << CS10) // FCPU/1024
#define TIMER_RESET     0   // timer resets and increpents at 1
#define TIMER_TOTAL     15625   //  resets per second
#define TIMER_TENTH     1560     // what to count to before cycling the rgb cycle

// EEPROM locations
// 168 has 512 bytes, 328 has 1k bytes
#define SERIAL_NUM      0     // Marker + 4 bytes for serial number
#define DAYLIGHT_SAVE   6     // Marker + 6 bytes for daylight save on & off 
#define RADIO_ADDR_TX   14    // marker + 5 byte address
#define RADIO_ADDR_R0   21    // marker + 5 byte address
#define RADIO_ADDR_R1   28    // marker + 5 byte address
#define RADIO_ADDR_R2   35    // marker + 1 byte address
#define RADIO_ADDR_R3   38    // marker + 1 byte address
#define RADIO_ADDR_R4   41    // marker + 1 byte address
#define RADIO_ADDR_R5   44    // marker + 1 byte address
#define INPUT_ADDR      48    // marker + 5 byte address
                              // skip 1 cause I hate odd numbers
// these depend on items above
#define SWITCH_STUFF    56    // 2 byte marker, NUM_SWITCHES byte values
#define INPUT           (SWITCH_STUFF + SWITCH_STUFF_BYTES)
#define LIMIT           (INPUT + (INPUT_BYTES * NUM_INPUTS) )
#define COLOR_CHANGE    (LIMIT + (LIMIT_BYTES * NUM_LIMITS) )
#define WEEKLY_PROGRAM  (COLOR_CHANGE + (COLOR_CHANGE_BYTES * NUM_COLOR_CHANGES) )    // The program
#define TWEAK_TIMER     (WEEKLY_PROGRAM + (WEEKLY_PROGRAM_BYTES * MAX_PROGRAM) )
#define PWM_DIR         (TWEAK_TIMER + TWEAK_TIMER_BYTES)
#define BRIGHTNESS      (PWM_DIR + PWM_DIR_BYTES)
#define SWITCH_PWM      (BRIGHTNESS + BRIGHTNESS_BYTES)
#define COLOR_CHANGABLE (SWITCH_PWM + (SWITCH_PWM_BYTES * NUM_SWITCHES))
#define INP_MESS_TIME   (COLOR_CHANGABLE + (NUM_COLOR_CHANGES * COLOR_CHANGABLE_BYTES))
#define HUESPEED        (INP_MESS_TIME + INP_MESS_TIME_BYTES)
#define COL_CHANGE      (HUESPEED + HUESPEED_BYTES)
#define GLOBAL_BRIGHT   (COL_CHANGE + COL_CHANGE_BYTES)

// check to make sure we aren't using too much ram
#if ((INP_MESS_TIME + INP_MESS_TIME_BYTES + BASE_PROG_RAM) > RAMEND)
#error Too many switches, programs, inputs & limits.  Out of RAM!
#endif



#if ((INP_MESS_TIME + INP_MESS_TIME_BYTES) > E2END)
#error Too many switches, programs, inputs & limits.  Out of EEPROM!
#endif

int main(void);

// command and interface
void checkCommand(char * commandReceived);
void fail(int failCode);
void ok(void);
int getInt(char * commandReceived, int first, int chars);
long getLong(char * commandReceived, int first, int chars);


int getSwitchNumber(char * commandReceived);
// switch related
void setNewSwitch(char * commandReceived);
void switchClear(char * commandReceived);
void clearTheSwitch(int switchNumber);
void switchDisplay(char * commandReceived);
void startSwitch(char * commandReceived);
void getPort(int switchNumber, char * port, char * pin, char * direction);
void switchBrightness(char * commandReceived);

// pwm related
void pwmSetup(char * commandReceived);
void pwmClear(int switchNumber);
void cycleHue(char * commandReceived);
void setHueSpeed(char * commandReceived);
void pwmValueSet(char * commandReceived);
void colorChangeSet(char * commandReceived);
void pwmSummary(void);
void runColorFunction(void);
void runHueFunction(void);
void brightnessSet(char * commandReceived);
void setImmediateChange(char * commandReceived);
void clearImmediateChange(void);


// all things program
void newProgram(char * commandReceived);
int findOpenSwitch(int programNumber);
void clearProgram(char * commandReceived);
void clearTheProgram(int programNumber); 
void programAddSwitch(char * commandReceived);
void programSetDays(char * commandReceived);
void programSetTime(char * commandReceived);
void programDisplay(char * commandReceived);
int  programGetSwitches(int programNumber, char * switches);
void startProgram(char * commandReceived);
void startTheProgram(int programNumber, int duration,long time);

// all things memory
void generalInit(void);
int readEEPROM(char * data, int memLocation, int memBytes);
void writeEEPROM(char * data, int memLocation, int memBytes);
void clearEEPROM(int memLocation);
void saveToEEPROM(void);// **
void clearToEEPROM(void);// **
void memoryDump(void); // dump out the memory
void interjectLineNumber(int lineNumber);
void resetStatus(int linecount, char * letter);
// all things clock
void clockInit(void);
void setClock(char * commandReceived);
void clockString(void);
void startClock(void);
void stopClock(void);
int getWeekday(int year, int month, int day);
int getDayofYear(int year, int month, int day);
void setDaylightSavings(char * commandReceived);
void checkDaylightSavings(void);
void advanceDay(void);
void timerCheck(void);
void switchOnOff(void);
void setTimeLimits(char * commandReceived);
void clockTweak(char * commandReceived);
// debug and output
void generalStatus(char * commandReceived);
void generalInformation(void);
void programsProgrammed(void);
void switchesProgrammed(void);
void inputsProgrammed(void);
void switchesOn(void);


void returnInt(int number, char * thisString);
void returnHex(unsigned int number, char * thisString);
void returnHexWithout(unsigned int number, char * tempMe);
// radio
uint64_t formatAddress(char * address);
void unformatAddress(uint64_t oldAddress, char * formattedAddress);
void radioInit(void);
int radioTest(void);
void radioDisplayAddress(char * commandReceived);
void radioChangeAddress(char * commandReceived);
void setRadioMode(char * commandReceived);
void sendMessage(char * msg);
void sendInputMessage(void);
// input related
void setAnalogInput(char * commandReceived); 
void setDigitalInput(char * commandReceived);
void inputCheck(void);
void inputTenthCheck(void);
void getInput(int inputNumber);
void possibleInputMessage(int inputNumber);
void setInputMessageTiming(char * commandReceived);
void clearInput(char * commandReceived);

void flashFail(void);
void clearFail(void);

