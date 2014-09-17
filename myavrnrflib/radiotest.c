#include <stdlib.h>
#include <string.h>
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include "nRF24L01.h"
#define DATA_SIZE 32
#include "nrf.h"
#include "../fleuryUARTlib/uart.h"
#include "spi.h"
#define UART_BAUD_RATE 28800



int main(void);
void printRegisters(void);
void readandprint(char reg, char * desc);
void readandprintaddr(char reg, char * desc);
uint64_t address;
int hiaddr;
long lowaddr;
char buffer[32];

// some variables
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
#define SET_RF_CH       42 // the answer

int main() {
    uart_init(UART_BAUD_SELECT(UART_BAUD_RATE, F_CPU));
    sei();
    uart_puts("begin\r\n");

    nrfInit();

    writeReg(RF_SETUP, SET_RF_SETUP);
    writeAddr(RX_ADDR_P0, SET_RX_ADDR_P0);
    writeAddr(TX_ADDR, SET_TX_ADDR);
    writeReg(DYNPD, SET_DYNPD);
    writeReg(FEATURE, SET_FEATURE);
    writeReg(RF_CH, SET_RF_CH);
    writeReg(CONFIG, SET_CONFIG);

    startRadio();


    uint8_t worked;
    uint8_t size;
    char sendbuffer[] = "Testing 1..2..3.. Testing.";
    size = sizeof (sendbuffer);
    char receivebuffer[33];
    char c;
    char count[10];
    int charbuffer;
    char payloadlength;
    //   uart_puts(sendbuffer);
    worked = transmit(sendbuffer, size);
    if (worked == 1) {
        uart_puts("Transmit Worked!\r\n");
    } else {
        uart_puts("Transmit Failed.\r\n");
    }
    startRx();

    while (1) {
        payloadlength = dynReceive(receivebuffer);
        if (payloadlength > 0) {
            uart_puts("Got something:");
            uart_puts(receivebuffer);
            uart_puts("\r\n");
        } else {
            uart_puts("nothin received\r\n");
        }

        c = uart_getc();
        if (!(c & UART_NO_DATA)) {
            uart_putc(c);
        }
        printRegisters();
        _delay_ms(2000);
    }


}

void printRegisters(void) {
    uart_puts("All registers.\r\n");
    readandprint(CONFIG, "CONFIG");
    readandprint(EN_AA, "EN_AA");
    readandprint(EN_RXADDR, "EN_RXADDR");
    readandprint(SETUP_AW, "SETUP_AW");
    readandprint(SETUP_RETR, "SETUP_RETR");
    readandprint(RF_CH, "RF_CH");
    readandprint(RF_SETUP, "RF_SETUP");
    readandprint(STATUS, "STATUS");
    readandprintaddr(RX_ADDR_P0, "RX_ADDR_P0");
    readandprintaddr(RX_ADDR_P1, "RX_ADDR_P1");
    readandprintaddr(RX_ADDR_P2, "RX_ADDR_P2");
    readandprintaddr(RX_ADDR_P3, "RX_ADDR_P3");
    readandprintaddr(RX_ADDR_P4, "RX_ADDR_P4");
    readandprintaddr(RX_ADDR_P5, "RX_ADDR_P5");
    readandprintaddr(TX_ADDR, "TX_ADDR");
    readandprint(RX_PW_P0, "RX_PW_P0");
    readandprint(RX_PW_P1, "RX_PW_P1");
    readandprint(RX_PW_P2, "RX_PW_P2");
    readandprint(RX_PW_P3, "RX_PW_P3");
    readandprint(RX_PW_P4, "RX_PW_P4");
    readandprint(RX_PW_P5, "RX_PW_P5");
    readandprint(FIFO_STATUS, "FIFO_STATUS");
    readandprint(DYNPD, "DYNPD");
}

void readandprint(char reg, char * desc) {
    char data = readReg(reg);
    itoa(data, buffer, 16);
    uart_puts(desc);
    uart_puts(": 0x");
    uart_puts(buffer);
    uart_puts("\r\n");
}

void readandprintaddr(char reg, char * desc) {
    uint64_t address = readAddr(reg);
    int highaddr = (address >> 32);
    long lowaddr = (address & 0xffffffff);
    uart_puts(desc);
    uart_puts(": 0x");
    itoa(highaddr, buffer, 16);
    uart_puts(buffer);
    ltoa(lowaddr, buffer, 16);
    uart_puts(buffer);
    uart_puts("\r\n");
}
