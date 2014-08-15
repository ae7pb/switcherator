#ifndef _NRF_H_
#define _NRF_H_

#include <avr/io.h>

// Pin definitions for chip select and chip enabled of the MiRF module
#define CE_PIN    PINB1
#define CSN_PIN   PINB2
#define CE_PORT   PORTB
#define CE_DDR    DDRB
#define CSN_PORT  PORTB
#define CSN_DDR   DDRB

#ifndef DATA_SIZE
#define DATA_SIZE 32
#endif

void nrfInit(void);
void startRadio(void);
void stopRadio(void);
void powerUp(void);
void powerDown(void);
void startRx(void);
void stopRx(void);
char readReg(char reg);
void writeReg(char reg, char data);
uint64_t readAddr( char reg);
void writeAddr( char reg, uint64_t address);
uint8_t getLength(void);
uint8_t checkRx(void);
uint8_t dynReceive(char * payload);
uint8_t receive(char * payload);
uint8_t transmit(char * payload, uint8_t datasize);
void flushme(void);



#endif // _NRF_H_
