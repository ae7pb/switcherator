#include "nrf.h"
#include "nRF24L01.h"
#include "spi.h"
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>

// connect to the radio and get the party started
void nrfInit(void) 
{
   spi_init();

   // Set up the CSN and CE as outputs
   CE_DDR |= (1<<CE_PIN);
   CSN_DDR |= (1<<CSN_PIN);
   flushme(); // start with clean buffers
}

// Power on the radio to standby mode (radio config register)
void startRadio(void) {
   char config = readReg(CONFIG);
   config |= (1 << PWR_UP);
   writeReg(CONFIG,config);
}

// Powers off the radio from standby mode
void stopRadio(void) {
   char config = readReg(CONFIG);
   config &= ~(1 << PWR_UP);
   writeReg(CONFIG,config);
}

// Powers up the radio - turns on CE pin
void powerUp(void) {
   CE_PORT |= (1<<CE_PIN);
}

// Power down the radio - turn off CE pin
void powerDown(void) {
   CE_PORT &= ~(1 << CE_PIN);
}

// Put the radio in receive mode
void startRx(void) {
   powerUp();
   char config = readReg(CONFIG);
   config |= (1 << PRIM_RX);
   writeReg(CONFIG, config);
}

// Cancel receive mode
void stopRx(void) {
   powerDown();
   char config = readReg(CONFIG);
   config &= ~(1 << PRIM_RX);
   writeReg(CONFIG, config);
}

// Read a register and return an uint8_t result
char readReg(char reg) {
   char datain[2];
   reg &= REGISTER_MASK;  // make sure command bits are clean
   reg |= R_REGISTER;
   char dataout[] = {reg, NOP};
   spi_transaction(dataout, datain, 2);
   char output = datain[1];
   return output;
}

// Write a register
void writeReg(char reg, char data) {
   char datain[2];
   reg &= REGISTER_MASK;
   reg |= W_REGISTER;
   char dataout[] = {reg , data};
   spi_transaction(dataout, datain, 2);
}

// Read the address specified by "reg" (which address) and return an
// integer of the address (40 bytes)
uint64_t readAddr( char reg) {
   char datain[6];
   uint64_t address = 0;
   reg &= REGISTER_MASK;
   reg |= R_REGISTER;
   // set up data out to get all 5 chars
   char dataout[] = {reg, NOP, NOP, NOP, NOP, NOP};
   // 3 addresses are 5 bytes but 4 are only 1 byte. Deal with the 4
   if ( (reg == (R_REGISTER | RX_ADDR_P2 )) ||
      (reg == (R_REGISTER | RX_ADDR_P3 )) ||
      (reg == (R_REGISTER | RX_ADDR_P4 )) ||
      (reg == (R_REGISTER | RX_ADDR_P5 ))) { // all the 1 byte returns
      dataout[0] = (R_REGISTER | RX_ADDR_P1); // MSB equal here 
      spi_transaction(dataout, datain, 6); // get the MSBs
      char lsb = readReg(reg);
      datain[1] = lsb;
   } else { // just get the 5 byte address
      spi_transaction(dataout, datain, 6);
   }
   // nrf addresses are LSB first
   for (int x = 5; x > 1; x--) {
      address |= datain[x];
      address = address << 8;
   }
   address |= datain[1];
   return address;
}

// Write the address specified. 
void writeAddr( char reg, uint64_t address) {
   if( (reg == RX_ADDR_P0) || (reg == RX_ADDR_P1) || (reg == TX_ADDR) ) {
      char datain[6];
      reg &= REGISTER_MASK;
      reg |= W_REGISTER;
      // nrf addresses are LSB first
      char dataout[] = {reg , (address & 0xff), ((address >> 8) & 0xff), 
         ((address >> 16) & 0xff), ((address >> 24) & 0xff), (address >> 32)};
      spi_transaction(dataout, datain, 6);
   } else {
      char lastByte = (address & 0xff);
      writeReg(reg, lastByte);
   }
}

// Returns the dynamic payload length
uint8_t getLength(void) {
   char dataout[] = {R_RX_PL_WID, NOP};
   char datain[2];
   uint8_t payloadLength;
   spi_transaction(dataout, datain, 2);
   payloadLength = datain[1];
   // if this returns more than 32 then there is a problem. flush it
   if (payloadLength > 32) {
      dataout[0] = FLUSH_RX;
      spi_transaction(dataout, datain, 1);
      return 0;
   }
   return payloadLength;
}

// check and see if anything is in the receive buffer
uint8_t checkRx(void) {
   char status = readReg(STATUS);
   if (status & 0x0E) { // 0x0E = RX FIFO empty
      return 0;
   } else {
      return 1;
   }
}

// Receive a payload with a dynamic length - returns length
// char * payload MUST BE 33 bytes. NO LESS
uint8_t dynReceive(char * payload) {
   uint8_t rxcheck = checkRx();
   if (rxcheck == 0) {
      return 0;
   }   
   _delay_ms(3); // small delay so entire message is ready first
   uint8_t payloadLength = getLength();
   if (payloadLength == 0) {
      return 0;
   }
   char dataout[(payloadLength + 1)];
   char datain[(payloadLength + 1)];
   dataout[0] = R_RX_PAYLOAD;
   // set up dataout
   for (int x = 0; x < payloadLength; x++) {
      dataout[(x + 1)] = NOP;
   }
   spi_transaction(dataout, datain, (payloadLength + 1));
   // Assign the data to the payload pointer. dataout[0] = status so skip it
   for (int y = 0; y < payloadLength; y++) {
      payload[y] = datain[(y + 1)];
   }
   char status = readReg(STATUS);
   status |= 0x40; // writing to the rx fifo to clear it
   writeReg(STATUS,status);
   payload[payloadLength] = 0;
   return payloadLength;
}

// Receive a fixed length payload
// char * payload must be DATA_SIZE or larger
uint8_t receive(char * payload) {
   uint8_t rxcheck = checkRx();
   if (rxcheck == 0) {
      return 0;
   }   
   char dataout[(DATA_SIZE + 1)];
   char datain[(DATA_SIZE + 1)];
   dataout[0] = R_RX_PAYLOAD;
   // set up dataout
   for (int x = 0; x < DATA_SIZE; x++) {
      dataout[(x + 1)] = NOP;
   }
   spi_transaction(dataout, datain, (DATA_SIZE + 1 ));
   // Assign the data to the payload pointer. dataout[0] = status so skip it
   for (int y = 0; y < DATA_SIZE; y++) {
      payload[y] = dataout[(y + 1)];
   }
   return 1;
}

// Send something.  Make sure you turn off receive first
uint8_t transmit(char * payload, uint8_t datasize) {
   char dataout[(datasize + 1)];
   char datain[(datasize + 1)];
   char status;
   char flush[] = {FLUSH_TX}; // flush tx command
   char dontcare[1]; // need a variable to receive
   dataout[0] = W_TX_PAYLOAD;
   for (int x = 0; x < datasize; x++) {
      dataout[(x+1)] = payload[x];
   }
   // fill the tx buffer
   spi_transaction(dataout, datain, (datasize +1));
   powerUp();
   // self induced time out loop incase it doesn't respond
   for (int y = 0; y < 100; y ++) {
      _delay_ms(2); // wait some arbitrary time
      // get tx status and see if it worked
      status = readReg(STATUS);
      if ((status & (1 << TX_DS)) == (1 << TX_DS)) { // it worked
         writeReg(STATUS, status); // clear the status
         powerDown();
         _delay_ms(2); // let receiver keep up
         return 1;
      } else if ((status & (1 << MAX_RT)) == (1 << MAX_RT)) { // radio time out
         writeReg(STATUS, status);
         spi_transaction(flush,dontcare,1); // clear the buffer
         powerDown();
         return 0;
      }
   }
   // if we are here we timed out
   spi_transaction(flush,dontcare,1);
   powerDown();
   return 0;
}

// flush the buffers
void flushme(void) {
   char flush[] = {FLUSH_TX};
   char dontcare[1];
   spi_transaction(flush, dontcare, 1);
   flush[0] = FLUSH_RX;
   spi_transaction(flush, dontcare, 1);
}
