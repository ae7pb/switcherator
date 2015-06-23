This is the switcherator automated switching system.  lol.  K whatever.  This module installs on a avr328p chip or compatible replacement.  Yes it works on the arduino uno and related.  In theory it can be used with other avr chips, in practice they need to have the same timing registers for it to work.  Otherwise the code is already ok with different ports for the different switches.  

The PWM function and the clockInit function will need to change if you are using a different style of chip.  The clockInit and the ISR(TIMER1_COMPA_vect) assume a 16mhz crystial and will need to be adjusted.  The TIMER_TOTAL definition may suffice to do this.

The program listens to all the radio traffic and responds either to a message starting with b (broadcast) or zxxxxxx where xxxxxx is the serial number assigned to the radio.  When you set up a new station the first thing you should do is assign it a serial number.  This needs to be 6 digits starting with 100001 or higher.  This is done by sending bse:10001 - broadcast, serial number then the number.  After this you can talk to just this radio with z10001 then the command z10001gs - general status.  Once a radio has a serial number it will no longer accept a new serial number in a broadcast so you can use multiple radios.  Make sure you "sa" save the serial number and other info to the radio.  Then if it loses power all you have to do is send it the current time and it will resume other duties as normal.

Here are the commands:  They are all two digits and can be upper or lower case.
TI:MMDDYYYYHHMMSS - Time
DS:MMDD MMDD - Daylight Savings
TL:##HHMMHHMMdddddd - Time Limits - Replace first H with x to clear or ? to inquire ** Only works on programs
NS:S#PpD - New Switch
SC:S# - Switch Clear
SD:xx - Switch Display
NP:HHMMDur. - New Program. Duration in minutes
CP:P# - Clear Program
PA:P#S# - Add switch to program
PD:P#SMTWTFS - Select days program will run - 1010000 = Sun & Tue
PT:P#HHMMDur. - program time - changes program time
PI:P# - program info
PS:P#S#H - PWM setup - p# is color change num, sw #then H=Hue, C=color change, 0=static color
WD:d - PWM Direction d=1 high, x shows it
CH:vvvv - Color Change speed - default 10=1 second in 1/10ths
HS:xx - Hue Speed - smooth number.  16 default
PW = PWM summary - 
CC:##,vvv,vvv,vvv,p  - color change values - ## is the color change number - p=1 = pwm only
SS:S#Durat. - start switch
SP:P#Durat. - start program
SA - Save
CL - clear saved
CT:xxxx - sets amount to adjust the timer.  15625? is default
RD:N - radio display address
RC:N 0xnnnnnnnnnn Radio change address
AI:##PpLLLHHH?##DuraPO - Analog input - ## input num, port/pin, LLL%,HHH%,? = (s)witch or (p)rogram, ## num, dur/poll time in seconds
DI:##Ppx?##DuraPO - Digital input. x=H/L for what activates switch
CI xx - Clear Input
GS - General Status
GI General Information
PP SW IP SO - display which programs / switches / inputs are programmed and on
IC:xxx,xxx,xxx,dura - Instant change - switch on PWM instantly duration in seconds
IT:xxxx - start receiving input messages and setting the timing between positive inputs and next message
RE Resets the chip (useful with the memory edit)
MW:AAAABBCdata-------------- memory write: AAAA = memory address BB = # bytes C = checksum (add up all digits of data then 0xff)
MR:AAAABB - memory Read

Fail Codes:
01 - Invalid Switch Number
02 - Invalid Program Number
03 - Invalid Port
04 - Invalid Pin
05 - Invalid Duration
06 - Switch in use
07 - Invalid Color Change Number
08 - All Programs are full
09 - Invalid Hour
0A - Invalid Minute
0B - Invalid Duration
0C - Switch is already added
0D - This is not a program
0E - No more memory for switches
0F - No days were selected
10 - Invalid time limit number
11 - Invalid Input
12 - Pin already set as output
13 - No colors Indicated
14 - PWM not set up
15 - Invalid Memory Checksum
