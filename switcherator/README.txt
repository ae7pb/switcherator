This is the switcherator automated switching system.  lol.  K whatever.  This module installs on a avr328p chip or compatible replacement.  Yes it works on the arduino uno and related.  In theory it can be used with other avr chips, in practice they need to have the same timing registers for it to work.  Otherwise the code is already ok with different ports for the different switches.  

The PWM function and the clockInit function will need to change if you are using a different style of chip.  The clockInit and the ISR(TIMER1_COMPA_vect) assume a 16mhz crystial and will need to be adjusted.  The TIMER_TOTAL definition may suffice to do this.

The program listens to all the radio traffic and responds either to a message starting with b (broadcast) or zxxxxxx where xxxxxx is the serial number assigned to the radio.  When you set up a new station the first thing you should do is assign it a serial number.  This needs to be 6 digits starting with 100001 or higher.  This is done by sending bse:10001 - broadcast, serial number then the number.  After this you can talk to just this radio with z10001 then the command z10001gs - general status.  Once a radio has a serial number it will no longer accept a new serial number in a broadcast so you can use multiple radios.  Make sure you "sa" save the serial number and other info to the radio.  Then if it loses power all you have to do is send it the current time and it will resume other duties as normal.

Here are the commands:  They are all two digits and can be upper or lower case.
TI:MMDDYYYYHHMMSS
Set the time.  ti:07282014105330 will be 7/28/2014 at 10:53:30 am.  Requesting a gs general status from the radio will give you the current time/

DS:MMDD MMDD
Daylight savings.  Set the month and day to auto adjust the time for daylight savings.  First MMDD is spring forward and the second MMDD is fall back.

TL:##HHMMHHMMdddddd
Set the time limits.  When you are turning on or off switches based on input (such as a motion sensor) this lets you set the times when the switch is active.  You can have multiple times when responding to input is allowed.  So ## is the time limit number, HHMM is the beginning time, HHMM is the ending time, and ddddddd sets the days so 1100001 means Sunday, Monday, and Saturday.  Doing an x for the first H clears the time limit and doing a ? for the first H returns the time limit info.

NS:S#PpD
New Switch.  S# - switch number, P=PORT, p=Pin, and D= direction.  So ns:00D21 is new switch, switch 0, port D pin 2 and a high output is on.

SC:S#
Switch Clear S# - erases the switch info

SD
SD - returns a summary of the switches #00 = switch 0, next is the Port or ? if not set, then Pin, then if High is on or low is on.


NP:HHMMDur.
New Program.  HHMM is start time and Dur. is the duration in minutes.  The radio will look for a new program slot and return the program number for you to put in the other settings.

CP:P#
Clear Program - clears the program number you specify.

PA:P#S#
Program Add (switch) - adds switch S# to program number P#

PD:P#SMTWTFS
Program Days - sets the days of the week that the program will run.  Set a 1 for each day.  So 1100001 would be Sunday, Monday and Saturday.


PT:P#HHMMDur.
Program Time - (re)sets the time you want the program to run and the duration

PI:P#
Program info - returns program information

PS:P#S#DH
PWM Setup - sets up the PWM.  P# is pwm number (currently only 00), s# is switch number to assign PWM to, d=direction (1 = high when on), H = Hue.  For H use 'H' or '1' for a smooth color change, 'c' for abrupt color changes or '0' for no color changes

CH:P#vvvv
Cycle Hue (speed)- Changes the speed the color changes. This is in 1/10ths of a second.

HS:xx
Changes the hue speed.  Default is 16, change with caution.

PV:P#,vvv,vvv,vvv
PWM Value set - P# = pwm # (currently on 00), vvv = the RGB values you want

PW = PWM summary
Sends the PWM values and Color change calues you set

CC:##,vvv,vvv,vvv 
Color change values - ## is the color change number (up to the max.)  So if you want 3 color changes you call this 3 times with 00, 01, 02 as the numbers

BS:16
Brightness Set - for PWM sets how bright the switch is up to a value of 16

SB S#16
Secondary Brightness - If for example normal PWM has a brightness of 8 you could set this to assign a switch number and secondary brightness.  So if the lights are dim at 8 (via PWM) and you trigger a switch with a motion sensor then this will override the normal dim brightness to whatever is set here.


SS:S#Durat.
Start Switch - turns on switch num S# for the duration.  This duration is in seconds (hence 6 digits for your duration)

SP:P#Durat.
Start Program - turns on program num P# for the duration in seconds

SA
Save - save all to eeprom

CL
Clear the eeprom

CTvvv
Tweaks the clock.  Adjusts the timer.  Positive makes a second longer, negative is less.  If your radio is out in the field without too many updates this can help make the time more accurate.  These are how many cycles the radio thinks is a second.  By default it is 15,625 cycles in a second.


RD:N
Radio display - N = 0-5 or T to display the different radio addresses.  

RC:N 0xnnnnnnnnnn
Radio Change - this will change the radio address specified. N = 0-5 or T.  See the nRF24L01 datasheet.  Use with caution since if you change the main address you will need to transmit to the same address.  This can be used to isolate various radios from each other.


AI:##PpLLLHHH?##DuraPO
Analog Input - ## = input number, Pp = the Port and Pin you are using for input (currently hardcoded for only port C but I guess I could change that), LLL is the low percentage used for an off condition, HHH = the high percentage for an on condition.  ?-Switch or Program with ## being the switch/program number.  Dura = duration in seconds, PO = the poll time - how often you are checking in seconds or 0 for every 1/10 seconds.

OK - so - if the input value from the analog input is under the LLL% then it is off.  If it is above the HHH% then it is on.  If it is between those percentages then it can be used to brighten / dim pwm values based on the percentages (assuming this is set to a pwm switch).  

DI:##Ppx?##DuraPO
Set Digital Input - ## = input number, Pp = port/pin, x=H/L for if the pin activates on a high input or low, ?=Program or Switch to activate, ## is program/switch number, Dura - duration in seconds, PO = poll time, 0 for 1/10th or 1+ for how many seconds between checks

CI xx
Clears an input

HE/RH
Help / Radio Help - shows a summary of commands

GS
Display general status.  Indicates the serial number and time and which programs / switches are set.

GI 
Display general information

PP SW IP SO - display which programs / switches / inputs are programmed and on

TI:MMDDYYYYHHMMSS - Time
DS:MMDD MMDD - Daylight Savings
TL:##HHMMHHMMdddddd - Time Limits - Replace first H with x to clear or ? to inquire
NS:S#PpD - New Switch
SC:S# - Switch Clear
SD:xx - Switch Display
NP:HHMMDur. - New Program. Duration in minutes
CP:P# - Clear Program
PA:P#S# - Add switch to program
PD:P#SMTWTFS - Select days program will run - 1010000 = Sun & Tue
PT:P#HHMMDur. - program time - changes program time
PI:P# - program info
PS:P#S#DH - PWM setup - p# is pwm num, sw #, D (1 = high) then H=Hue, C=color change, 0=static color
CH:P#vvvv - Color Change speed - default 10=1 second in 1/10ths
HS:xx - Hue Speed - smooth number.  16 default
PV:P#,vvv,vvv,vvv - set values for status pwm
PW = PWM summary - 
CC:##,vvv,vvv,vvv  - color change values - ## is the color change number
BS:16 - changes brightness of a pwm switch
SB S#16 - sets a second brightness for pwm that can be set off by an input
SS:S#Durat. - start switch
SP:P#Durat. - start progam
SA - Save
CL - clear saved
CT:xxxx - sets amount to adjust the timer.  15625? is default
RD:N - radio display address
RC:N 0xnnnnnnnnnn Radio change address
AI:##PpLLLHHH?##DuraPO - Analog input - ## input num, port/pin, LLL%,HHH%,? = (s)witch or (p)rogram, ## num, dur/poll time in seconds
DI:##Ppx?##DuraPO - Digital input. ?=H/L for what activates switch
CI xx - Clear Input
GS - General Status
GI General Information
PP SW IP SO - display which programs / switches / inputs are programmed and on

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
